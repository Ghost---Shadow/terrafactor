#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { mergeStatesV3, mergeStatesV4 } = require('./state-merger');
const { walk } = require('./walker');

const inputDir = process.argv[2];
const outputDir = process.argv[3];

if (!inputDir || !outputDir) {
  console.error('Usage:\n\nterrafactor ./inputDir ./outputDir');

  process.exit(1);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

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
  console.error(`Unknown version ${allStates[0].version}`);

  process.exit(1);
}

const mergedState = mergerFun(allStates);

fs.writeFileSync(path.join(outputDir, 'terraform.tfstate'), JSON.stringify(mergedState, null, 2));
