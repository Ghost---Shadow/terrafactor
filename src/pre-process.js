const fs = require('fs');
const path = require('path');
const { argv } = require('yargs');
const { mergeStatesV3, mergeStatesV4 } = require('./state-merger');
const { walk } = require('./walker');

const sanitizeInputs = () => {
  const positionalArgv = argv._;
  const inputDir = positionalArgv[0];
  const outputDir = positionalArgv[1] || './terrafactor_output';
  if (!inputDir || !outputDir) {
    console.error('Usage:\n\nterrafactor ./inputDir ./outputDir');

    process.exit(1);
  }
  const shouldModularize = argv.modularize === undefined
    ? true : JSON.parse(argv.modularize); // Typecast to bool
  return { inputDir, outputDir, shouldModularize };
};

const makeAllDirsIfNotExists = (outputDir) => {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  const mstDir = `${outputDir}_mst`;
  if (!fs.existsSync(mstDir)) {
    fs.mkdirSync(mstDir);
  }

  const processedDir = `${outputDir}_processed`;
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir);
  }
  return { mstDir, processedDir };
};

const copyAndMerge = (inputDir, outputDir) => {
  const files = walk(inputDir);

  files.forEach((filePath) => {
    const fileName = path.basename(filePath);
    if (!fileName.endsWith('.tfstate')) {
      const outputFilePath = path.join(outputDir, fileName);
      if (!fs.existsSync(outputFilePath)) {
        fs.copyFileSync(filePath, outputFilePath);
      } else {
        if (outputFilePath.match(/provider\.tf/)) return;
        if (outputFilePath.match(/variables\.tf/)) return;
        console.log(`Found duplicate files, merging ${outputFilePath}`);
        const before = fs.readFileSync(outputFilePath);
        const after = before + fs.readFileSync(filePath);
        fs.writeFileSync(outputFilePath, after);
      }
    }
  });

  const allStates = files
    .filter((fileName) => fileName.endsWith('.tfstate'))
    .map((fileName) => JSON.parse(fs.readFileSync(fileName).toString()));

  const mergerFun = {
    3: mergeStatesV3,
    4: mergeStatesV4,
  }[allStates[0].version];

  if (!mergerFun) {
    console.error(`Unsupported version ${allStates[0].version}, supported versions are ${Object.keys(mergerFun).join(',')}`);

    process.exit(1);
  }

  const mergedState = mergerFun(allStates);

  fs.writeFileSync(path.join(outputDir, 'terraform.tfstate'), JSON.stringify(mergedState, null, 2));
};

module.exports = {
  makeAllDirsIfNotExists,
  sanitizeInputs,
  copyAndMerge,
};
