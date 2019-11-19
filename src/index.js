#!/usr/bin/env node

const { spawnSync } = require('child_process');
const { chdir, cwd } = require('process');
const { makeAllDirsIfNotExists, sanitizeInputs, copyAndMerge } = require('./pre-process');
const { postProcess } = require('./post-process');
const { modularize } = require('./modularizer');

(async () => {
  const { inputDir, outputDir, shouldModularize } = sanitizeInputs();
  const { mstDir, processedDir } = await makeAllDirsIfNotExists(outputDir);
  await copyAndMerge(inputDir, outputDir);
  console.log('Updating tfstate to version 4. Please wait');
  const currentDir = cwd();
  chdir(outputDir);
  spawnSync('terraform', ['init'], { stdio: 'inherit' });
  spawnSync('terraform', ['refresh'], { stdio: 'inherit' });
  chdir(currentDir);
  if (shouldModularize) {
    console.log('Modularizing');
    await modularize(outputDir, mstDir);
    console.log('Post processing');
    await postProcess(mstDir, processedDir, true);
  } else {
    console.log('Skipping Modularization');
    console.log('Post processing');
    await postProcess(outputDir, processedDir, false);
  }
})();
