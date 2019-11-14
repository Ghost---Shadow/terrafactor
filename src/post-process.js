const path = require('path');
const fs = require('fs');
const util = require('util');

const escapeStringRegexp = require('escape-string-regexp');

const { genInverseLut, filterOnlyIdsLut } = require('./common');

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const copyFile = util.promisify(fs.copyFile);

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
