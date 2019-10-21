const fs = require('fs');
const path = require('path');

const checkIfDirectoryShouldBeIgnored = (fullPath) => !!fullPath
  .match(/\.terraform/);

const checkIfFileShouldBeIgnored = (fullPath) => {
  const hasTfExtension = fullPath.trim().match(/\.tf$/i);
  const hasHCLExtension = fullPath.trim().match(/\.hcl$/i);
  const isTfState = fullPath.trim().match(/\.tfstate$/i);

  return !(hasTfExtension || hasHCLExtension || isTfState);
};

const walk = (rootDir, allFiles = []) => {
  const files = fs.readdirSync(rootDir);
  files.forEach((file) => {
    const fullPath = path.join(rootDir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!checkIfDirectoryShouldBeIgnored(fullPath)) {
        walk(fullPath, allFiles);
      }
    } else if (!checkIfFileShouldBeIgnored(fullPath)) {
      allFiles.push(fullPath);
    }
  });
  return allFiles;
};

module.exports = {
  walk,
};
