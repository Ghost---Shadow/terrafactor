const path = require('path');
const fs = require('fs');
const util = require('util');

const _ = require('lodash');
const escapeStringRegexp = require('escape-string-regexp');

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const copyFile = util.promisify(fs.copyFile);

const arrayLike = (acc, key, val) => {
  if (acc[key] === undefined) {
    acc[key] = [val];
    return acc;
  }
  acc[key].push(val);
  return acc;
};

const customMerge = (obj1, obj2) => Object.keys(obj2)
  .reduce((acc, key) => {
    if (acc[key] !== undefined) {
      acc[key] = acc[key].concat(obj2[key]);
      return acc;
    }
    acc[key] = obj2[key];
    return acc;
  }, obj1);

const attributeReducerFunctor = (resource, instance) => (lutAcc, key) => {
  const target = `${resource.type}.${resource.name}.${key}`;
  const value = instance.attributes[key];
  return arrayLike(lutAcc, value, target);
};

const getValidKeys = (attributes) => {
  // Pick only non empty string like attributes
  const nonNullStrings = Object.keys(attributes)
    .filter(((key) => _.isString(attributes[key])))
    .filter(((key) => !_.isEmpty(attributes[key])));

  // TODO: Find a more robust solution
  // Remove self references
  const counterLut = nonNullStrings.reduce((acc, key) => {
    acc[attributes[key]] = acc[attributes[key]] === undefined
      ? { key, count: 1 } : { key, count: acc[attributes[key]].count + 1 };
    return acc;
  }, {});

  return Object.keys(counterLut)
    .filter((key) => counterLut[key].count === 1)
    .map((key) => counterLut[key].key);
};

const instanceReducerFunctor = (resource) => (instanceAcc, instance) => {
  const validKeys = getValidKeys(instance.attributes);
  const inverseLutForInstance = validKeys.reduce(attributeReducerFunctor(resource, instance), {});
  return customMerge(instanceAcc, inverseLutForInstance);
};

const resourceReducerFunctor = () => (resourcesAcc, resource) => {
  const totalLut = resource.instances.reduce(instanceReducerFunctor(resource), {});
  return customMerge(resourcesAcc, totalLut);
};

const genInverseLut = (resources) => resources.reduce(resourceReducerFunctor(), {});

const toRegexLut = (inverseLut) => Object.keys(inverseLut)
  .reduce((acc, key) => {
    const regex = `"${escapeStringRegexp(key)}"`;
    return {
      ...acc,
      [regex]: inverseLut[key],
    };
  }, {});

const processFile = (fileContents, regexLut) => Object.keys(regexLut)
  .reduce((lastFileContents, nextRegex) => {
    const regex = new RegExp(nextRegex, 'g');
    return lastFileContents
      .replace(regex, `"$\{${regexLut[nextRegex]}}"`);
  }, fileContents);

const filterOnlyIdsLut = (lut) => Object.keys(lut).reduce((acc, key) => {
  const id = lut[key].filter((maybeId) => maybeId.endsWith('.id'))[0];
  if (id) return { ...acc, [key]: id };
  return acc;
}, {});

const filterOnlyNotIdsLut = (lut, dryness = 2) => Object.keys(lut).reduce((acc, key) => {
  const ids = lut[key].filter((maybeId) => maybeId.endsWith('.id'));
  // DRY: Dont repeat yourself
  const isWetEnough = lut[key].length >= dryness;
  const isIdReference = !!ids.length;
  if (!isIdReference && isWetEnough) return { ...acc, [key]: lut[key] };
  return acc;
}, {});

const varToValueLut = (lut) => {
  const valueLut = Object.keys(lut)
    .reduce((acc, key) => {
      const parts = lut[key][0].split('.');
      const name = parts[parts.length - 1];
      // Trailing underscore is to disambiguate from
      // keywords like count or version
      let nonConflictingName = `${name}_`;
      let i = 1;
      while (acc[nonConflictingName]) {
        nonConflictingName = `${name}_${i}`;
        i += 1;
      }
      return {
        ...acc,
        [nonConflictingName]: key,
      };
    }, {});

  // Sort the keys for git stability
  const sortedLut = Object.keys(valueLut).sort()
    .reduce((acc, key) => ({ ...acc, [key]: valueLut[key] }), {});

  // Invert the mapping
  return Object.keys(sortedLut)
    .reduce((acc, key) => ({ ...acc, [sortedLut[key]]: key }), {});
};

const valueLutToVarFile = (valueLut) => Object.keys(valueLut)
  .reduce((acc, key) => `${acc}
variable "${valueLut[key]}" {
  type = string
  default = "${key}"
}
`, '');

const mergeLuts = (idsLut, valueLut) => {
  const varLut = Object.keys(valueLut)
    .reduce((acc, key) => ({
      ...acc,
      [key]: `var.${valueLut[key]}`,
    }), {});

  return { ...idsLut, ...varLut };
};

const postProcess = async (generatedDir, outputDir) => {
  const statePath = path.join(generatedDir, 'terraform.tfstate');
  const stateJson = JSON.parse(fs.readFileSync(statePath).toString());
  if (stateJson.version !== 4) {
    console.error('Only tfstate version 4 is supported');
    process.exit(1);
  }

  const { resources } = stateJson;

  const inverseLut = genInverseLut(resources);
  const idsLut = filterOnlyIdsLut(inverseLut);
  const notIdsLut = filterOnlyNotIdsLut(inverseLut);
  const valueLut = varToValueLut(notIdsLut);
  const varFileString = valueLutToVarFile(valueLut);
  const mergedLuts = mergeLuts(idsLut, valueLut);
  const regexLut = toRegexLut(mergedLuts);

  const tfFileNames = (await readdir(generatedDir))
    .filter((maybeFile) => maybeFile.match(/(\.tf$|\.hcl$)/));
  const replacePromises = tfFileNames.map(async (fileName) => {
    const inputFilePath = path.join(generatedDir, fileName);
    const outputFilePath = path.join(outputDir, fileName);
    const tfFileContents = (await readFile(inputFilePath)).toString();
    const processedFile = processFile(tfFileContents, regexLut);
    return writeFile(outputFilePath, processedFile);
  });

  const copyPromise = copyFile(path.join(generatedDir, 'terraform.tfstate'),
    path.join(outputDir, 'terraform.tfstate'));
  const varFilePromise = writeFile(path.join(outputDir, 'variables.tf'), varFileString);

  return Promise.all([...replacePromises, copyPromise, varFilePromise]);
};

module.exports = {
  postProcess,
};
