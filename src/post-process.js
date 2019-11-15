const path = require('path');
const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const escapeStringRegexp = require('escape-string-regexp');

const { genInverseLut, filterOnlyIdsLut } = require('./common');

const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const copyFile = util.promisify(fs.copyFile);
const exists = util.promisify(fs.exists);
const mkdir = util.promisify(fs.mkdir);

// For testing
const dumpJson = () => null;
// const dumpJson = (name, contents) => {
//   const isJson = !(typeof contents === 'string');
//   const fileName = isJson ? `jsons/${name}.json` : `jsons/${name}.txt`;
//   const fileContents = isJson ? JSON.stringify(contents, null, 2) : contents;
//   fs.writeFileSync(fileName, fileContents);
// };

const toRegexLut = (inverseLut) => {
  dumpJson('toRegexLut-inverseLut', inverseLut);
  const keys = Object.keys(inverseLut);
  const result = keys.reduce((acc, key) => {
    const regex = `"${escapeStringRegexp(key)}"`;
    return {
      ...acc,
      [regex]: inverseLut[key],
    };
  }, {});
  dumpJson('toRegexLut-result', result);
  return result;
};

const processFile = (fileContents, regexLut) => {
  dumpJson('processFile-fileContents', fileContents);
  dumpJson('processFile-regexLut', regexLut);
  const result = Object.keys(regexLut)
    .reduce((lastFileContents, nextRegex) => {
      const regex = new RegExp(nextRegex, 'g');
      return lastFileContents
        .replace(regex, `"$\{${regexLut[nextRegex]}}"`);
    }, fileContents);
  dumpJson('processFile-result', result);
  return result;
};

const filterOnlyNotIdsLut = (lut, dryness = 2) => {
  dumpJson('filterOnlyNotIdsLut-lut', lut);
  const result = Object.keys(lut).reduce((acc, key) => {
    const ids = lut[key].filter((maybeId) => maybeId.endsWith('.id'));
    // DRY: Dont repeat yourself
    const isWetEnough = lut[key].length >= dryness;
    const isIdReference = !!ids.length;
    if (!isIdReference && isWetEnough) return { ...acc, [key]: lut[key] };
    return acc;
  }, {});
  dumpJson('filterOnlyNotIdsLut-result', result);
  return result;
};

const varToValueLut = (lut) => {
  dumpJson('varToValueLut-lut', lut);
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
  const result = Object.keys(sortedLut)
    .reduce((acc, key) => ({ ...acc, [sortedLut[key]]: key }), {});
  dumpJson('varToValueLut-result', result);
  return result;
};

const valueLutToVarFile = (valueLut) => {
  dumpJson('valueLutToVarFile-valueLut', valueLut);
  const fileString = Object.keys(valueLut)
    .reduce((acc, key) => `${acc}
variable "${valueLut[key]}" {
  type = string
  default = "${key}"
}
`, '');
  dumpJson('valueLutToVarFile-fileString', fileString);
  return fileString;
};

const mergeLuts = (idsLut, valueLut) => {
  dumpJson('mergeLuts-idsLut', idsLut);
  dumpJson('mergeLuts-valueLut', valueLut);
  const varLut = Object.keys(valueLut)
    .reduce((acc, key) => ({
      ...acc,
      [key]: `var.${valueLut[key]}`,
    }), {});

  const result = { ...idsLut, ...varLut };
  dumpJson('mergeLuts-result', result);
  return result;
};

const tfStateToRegexLut = (tfState) => {
  dumpJson('tfStateToRegexLut-tfState', tfState);
  const { resources } = tfState;
  const inverseLut = genInverseLut(resources);
  const idsLut = filterOnlyIdsLut(inverseLut);
  const notIdsLut = filterOnlyNotIdsLut(inverseLut);
  const valueLut = varToValueLut(notIdsLut);
  const varFileString = valueLutToVarFile(valueLut);
  const mergedLuts = mergeLuts(idsLut, valueLut);
  const regexLut = toRegexLut(mergedLuts);
  const result = { regexLut, varFileString };
  dumpJson('tfStateToRegexLut-result', result);
  return result;
};

const replaceAllFilesInDir = async (dirToScan, outputDir, regexLut) => {
  dumpJson('replaceAllFilesInDir-dirToScan', dirToScan);
  dumpJson('replaceAllFilesInDir-outputDir', outputDir);
  dumpJson('replaceAllFilesInDir-regexLut', regexLut);
  const tfFileNames = (await readdir(dirToScan))
    .filter((maybeFile) => maybeFile.match(/(\.tf$|\.hcl$)/))
    .filter((fileName) => !(fileName.match('provider.tf') || fileName.match('outputs.tf')));

  const replacePromises = tfFileNames.map(async (fileName) => {
    const inputFilePath = path.join(dirToScan, fileName);
    const outputFilePath = path.join(outputDir, fileName);
    const tfFileContents = (await readFile(inputFilePath)).toString();
    const processedFile = processFile(tfFileContents, regexLut);
    return writeFile(outputFilePath, processedFile);
  });
  return Promise.all(replacePromises);
};

const extractAllUsedVarsInFile = (fileString) => {
  dumpJson('extractAllUsedVarsInFile-fileString', fileString);
  const groups = [];
  const myRegexp = /\$\{var\.(.*)\}/g;
  let match = myRegexp.exec(fileString);
  while (match != null) {
    groups.push(match[1]);
    match = myRegexp.exec(fileString);
  }
  dumpJson('extractAllUsedVarsInFile-groups', groups);
  return groups;
};

const extractAllUsedVarsInDir = async (dir) => {
  dumpJson('extractAllUsedVarsInDir-dir', dir);
  const fileNames = await readdir(dir);
  const tfFiles = fileNames.filter((fn) => fn.endsWith('.tf'));
  const varPromises = tfFiles.map(async (fn) => {
    const fileString = (await readFile(path.join(dir, fn))).toString();
    return extractAllUsedVarsInFile(fileString);
  });
  const allVars = await Promise.all(varPromises);
  const uniqVars = _.uniq(_.flatten(allVars));
  dumpJson('extractAllUsedVarsInDir-uniqVars', uniqVars);
  return uniqVars;
};

const filterVarFile = (varFileContents, varsInScope) => {
  const varArray = varFileContents.split('variable ');
  const filteredVars = varArray.map((v) => /"(.*)"/.exec(v)).filter((v) => v);
  const lut = filteredVars.reduce((acc, next) => ({
    ...acc,
    [next[1]]: next.input,
  }), {});
  const resultString = varsInScope.sort().reduce((acc, next) => `${acc}variable ${lut[next]}`, '');
  return resultString;
};

const processDir = async (fromDir, toDir, regexLut, varFileString) => {
  dumpJson('processDir-fromDir', fromDir);
  dumpJson('processDir-toDir', toDir);
  dumpJson('processDir-regexLut', regexLut);
  dumpJson('processDir-varFileString', varFileString);
  const isDirExist = await exists(toDir);
  if (!isDirExist) await mkdir(toDir);
  await replaceAllFilesInDir(fromDir, toDir, regexLut);
  const usedVars = await extractAllUsedVarsInDir(toDir);
  const filtedVarFile = filterVarFile(varFileString, usedVars);
  await writeFile(path.join(toDir, 'variables.tf'), filtedVarFile);
};

const postProcess = async (fromDir, toDir) => {
  const statePath = path.join(fromDir, 'terraform.tfstate');
  const stateJson = JSON.parse(fs.readFileSync(statePath).toString());
  if (stateJson.version !== 4) {
    console.error('Only tfstate version 4 is supported');
    process.exit(1);
  }

  const { regexLut, varFileString } = tfStateToRegexLut(stateJson);
  const stateCopyPromise = copyFile(path.join(fromDir, 'terraform.tfstate'),
    path.join(toDir, 'terraform.tfstate'));
  const mainTfCopyPromise = copyFile(path.join(fromDir, 'main.tf'),
    path.join(toDir, 'main.tf'));
  const providerTfCopyPromise = copyFile(path.join(fromDir, 'provider.tf'), path.join(toDir, 'provider.tf'));

  const allDirPromises = (await readdir(fromDir))
    .map(async (fileName) => {
      const s = await stat(path.join(fromDir, fileName));
      return { fileName, dir: s.isDirectory() };
    });
  const allDirs = (await Promise.all(allDirPromises))
    .filter((d) => d.dir)
    .map((d) => d.fileName)
    .filter((d) => d !== '.terraform');
  const modulePromises = allDirs
    .map((moduleDir) => processDir(
      path.join(fromDir, moduleDir),
      path.join(toDir, moduleDir),
      regexLut, varFileString,
    ));

  return Promise.all([...modulePromises,
    stateCopyPromise, mainTfCopyPromise,
    providerTfCopyPromise]);
};

module.exports = {
  toRegexLut,
  processFile,
  filterOnlyNotIdsLut,
  varToValueLut,
  valueLutToVarFile,
  mergeLuts,
  tfStateToRegexLut,
  replaceAllFilesInDir,
  extractAllUsedVarsInFile,
  extractAllUsedVarsInDir,
  filterVarFile,
  postProcess,
};
