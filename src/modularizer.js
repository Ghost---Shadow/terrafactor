const fs = require('fs');
const util = require('util');
const path = require('path');
const _ = require('lodash');
const flatten = require('flat');

const readFile = util.promisify(fs.readFile);
const exists = util.promisify(fs.exists);
const mkdir = util.promisify(fs.mkdir);
const readdir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);

// There must be greater than MIN_MODULE_SIZE connected components to be considered a module
const MIN_MODULE_SIZE = 2;

// For testing
const dumpJson = () => null;
// const dumpJson = (name, contents) => {
//   const isJson = !(typeof contents === 'string');
//   const fileName = isJson ? `jsons/${name}.json` : `jsons/${name}.txt`;
//   const fileContents = isJson ? JSON.stringify(contents, null, 2) : contents;
//   fs.writeFileSync(fileName, fileContents);
// };

const getNameFromResource = (r) => `${r.provider}.${r.type}.${r.name}`;

const getNameFromId = (tfState, id) => {
  dumpJson('getNameFromId-tfState', tfState);
  dumpJson('getNameFromId-id', id);
  // TODO: Handle multiple instances
  const resource = tfState.resources.filter((r) => r.instances[0].attributes.id === id)[0];
  const result = getNameFromResource(resource);
  dumpJson('getNameFromId-result', result);
  return result;
};

const getValidNamesFromResource = (tfState, resource, allValidIds, allNames) => {
  dumpJson('getValidNamesFromResource-tfState', tfState);
  dumpJson('getValidNamesFromResource-resource', resource);
  dumpJson('getValidNamesFromResource-allValidIds', allValidIds);
  dumpJson('getValidNamesFromResource-allNames', allNames);
  const flatAttributes = flatten(resource.instances[0].attributes);
  const attributeKeys = Object.keys(flatAttributes);
  const attributeWithIdAsValue = attributeKeys
    .filter((k) => allValidIds.indexOf(flatAttributes[k]) > -1);
  const filteredOutSelfReference = attributeWithIdAsValue.filter((k) => k !== 'id');
  const idArr = filteredOutSelfReference.map((k) => flatAttributes[k]);
  const result = idArr.map((id) => getNameFromId(tfState, id));
  dumpJson('getValidNamesFromResource-result', result);
  return result;
};

const getResourceForName = (tfState, fullName) => {
  dumpJson('getResourceForName-tfState', tfState);
  dumpJson('getResourceForName-fullName', fullName);
  const fullNameArr = fullName.split('.');
  const name = _.nth(fullNameArr, -1);
  const type = _.nth(fullNameArr, -2);
  const result = tfState.resources
    .filter((resource) => resource.name === name
    && resource.type === type)[0];
  dumpJson('getResourceForName-result', result);
  return result;
};

const generateAdjacencyMatrix = (tfState, allValidIds, allNames) => {
  dumpJson('generateAdjacencyMatrix-tfState', tfState);
  dumpJson('generateAdjacencyMatrix-allValidIds', allValidIds);
  dumpJson('generateAdjacencyMatrix-allNames', allNames);
  const result = {};
  for (let i = 0; i < allNames.length; i += 1) {
    const from = allNames[i];
    const fromResource = getResourceForName(tfState, from);
    const toNames = getValidNamesFromResource(tfState, fromResource, allValidIds, allNames);
    for (let j = 0; j < toNames.length; j += 1) {
      const to = toNames[j];
      if (result[from] === undefined) result[from] = {};
      if (result[to] === undefined) result[to] = {};
      result[from][to] = true;
      result[to][from] = true;
    }
  }
  dumpJson('generateAdjacencyMatrix-result', result);
  return result;
};

const getAllConnectedComponentsForName = (tfState, allNames, adj, visited, color, name) => {
  if (visited[name]) {
    return visited;
  }
  const newVisited = _.merge(visited, { [name]: color });
  dumpJson('getAllConnectedComponentsForName-tfState', tfState);
  dumpJson('getAllConnectedComponentsForName-allNames', allNames);
  dumpJson('getAllConnectedComponentsForName-adj', adj);
  dumpJson('getAllConnectedComponentsForName-visited', visited);
  dumpJson('getAllConnectedComponentsForName-color', color);
  dumpJson('getAllConnectedComponentsForName-name', name);

  // If component isnt connected to anything then do nothing
  if (adj[name] === undefined) return newVisited;
  const childNames = Object.keys(adj[name]);

  const result = childNames
    .reduce((runningVisited, childName) => getAllConnectedComponentsForName(
      tfState,
      allNames,
      adj,
      runningVisited,
      color,
      childName,
    ),
    newVisited);
  dumpJson('getAllConnectedComponentsForName-result', result);
  return result;
};

const colorAllConnectedComponents = (tfState, allNames, adj) => {
  dumpJson('colorAllConnectedComponents-tfState', tfState);
  dumpJson('colorAllConnectedComponents-allNames', allNames);
  dumpJson('colorAllConnectedComponents-adj', adj);
  let visited = allNames.reduce((acc, k) => ({ ...acc, [k]: false }), {});
  let color = 0;

  for (let i = 0; i < allNames.length; i += 1) {
    if (!visited[allNames[i]]) { color += 1; }
    visited = getAllConnectedComponentsForName(tfState,
      allNames,
      adj,
      visited,
      color,
      allNames[i]);
  }
  dumpJson('colorAllConnectedComponents-visited', visited);
  return visited;
};

const coloredComponentsTo2dArr = (coloredComponents) => {
  dumpJson('coloredComponentsTo2dArr-coloredComponents', coloredComponents);
  const invLut = Object.keys(coloredComponents).reduce((acc, id) => {
    const color = coloredComponents[id];
    const idVec = acc[color] || [];
    idVec.push(id);
    return {
      ...acc,
      [color]: idVec,
    };
  }, {});

  const modules = [[]];
  const colors = Object.keys(invLut);
  for (let i = 0; i < colors.length; i += 1) {
    const color = colors[i];
    if (invLut[color].length > MIN_MODULE_SIZE) {
      modules.push(invLut[color]);
    } else {
      modules[0] = modules[0].concat(invLut[color]);
    }
  }
  dumpJson('coloredComponentsTo2dArr-modules', modules);
  return modules;
};

const getModuleIdFromResource = (componentArr, resource) => {
  dumpJson('getModuleIdFromResource-componentArr', componentArr);
  dumpJson('getModuleIdFromResource-resource', resource);
  const name = getNameFromResource(resource);
  for (let i = 0; i < componentArr.length; i += 1) {
    if (componentArr[i].indexOf(name) > -1) {
      dumpJson('getModuleIdFromResource-id', i);
      return i;
    }
  }
  return 0;
};

const addModuleToTfState = (tfState, componentArr) => {
  dumpJson('addModuleToTfState-tfState', tfState);
  dumpJson('addModuleToTfState-componentArr', componentArr);
  const tfs = _.cloneDeep(tfState);

  for (let r = 0; r < tfs.resources.length; r += 1) {
    const moduleId = getModuleIdFromResource(componentArr, tfs.resources[r]);
    tfs.resources[r].module = `module.mod_${moduleId}`;
  }
  dumpJson('addModuleToTfState-tfs', tfs);
  return tfs;
};

const generateNameToHclLut = (tfState, hclArray) => {
  dumpJson('generateNameToHclLut-tfState', tfState);
  dumpJson('generateNameToHclLut-hclArray', hclArray);
  const names = hclArray.map((res) => res.match(/resource "\S+" "(.*)"/)[1]);
  const alignedResources = names.map((name) => _.find(tfState.resources, { name }));
  const result = alignedResources.reduce((acc, resource, index) => {
    const name = getNameFromResource(resource);
    return {
      ...acc,
      [name]: hclArray[index],
    };
  }, {});
  dumpJson('generateNameToHclLut-result', result);
  return result;
};

const mainTfGenerator = (numModules) => {
  dumpJson('mainTfGenerator-numModules', numModules);
  const result = [...Array(numModules)]
    .reduce((acc, next, index) => `
${acc}
module "mod_${index}" {
  source = "./mod_${index}"
}
`, '');
  dumpJson('mainTfGenerator-result', result);
  return result;
};

const moduleToTfFiles = async (nameToHclLut, mod, dirPath) => {
  dumpJson('moduleToTfFiles-nameToHclLut', nameToHclLut);
  dumpJson('moduleToTfFiles-mod', mod);
  dumpJson('moduleToTfFiles-dirPath', dirPath);
  const tfFileLut = mod.reduce((acc, id) => {
    const fileName = `${_.nth(id.split('.'), -2)}.tf`;
    return { ...acc, [fileName]: `${acc[fileName] || ''}${nameToHclLut[id]}` };
  }, {});
  const writePromises = Object.keys(tfFileLut)
    .map((key) => writeFile(path.join(dirPath, key), tfFileLut[key]));
  return Promise.all(writePromises);
};

const modularize = async (generatedDir, outputDir) => {
  const statePath = path.join(generatedDir, 'terraform.tfstate');
  const tfState = JSON.parse((await readFile(statePath)).toString());
  if (tfState.version !== 4) {
    console.error('Only tfstate version 4 is supported');
    process.exit(1);
  }

  const { resources } = tfState;
  const allNames = resources.map((r) => getNameFromResource(r));
  // TODO: Handle multiple instances
  const allResourceIds = resources.map((r) => r.instances[0].attributes.id);
  const adj = generateAdjacencyMatrix(tfState, allResourceIds, allNames);
  const coloredComponents = colorAllConnectedComponents(tfState, allNames, adj);
  const componentArr = coloredComponentsTo2dArr(coloredComponents);
  const newTfState = addModuleToTfState(tfState, componentArr);
  const newStatePath = path.join(outputDir, 'terraform.tfstate');
  await writeFile(newStatePath, JSON.stringify(newTfState, null, 2));

  const tfFileNames = (await readdir(generatedDir))
    .filter((maybeFile) => maybeFile.match(/(\.tf$|\.hcl$)/))
    .filter((maybeFile) => ['provider.tf', 'outputs.tf', 'variables.tf'].indexOf(maybeFile) === -1);
  const fileRead = tfFileNames.map(async (fileName) => {
    const inputFilePath = path.join(generatedDir, fileName);
    return (await readFile(inputFilePath)).toString();
  });
  const allFiles = await Promise.all(fileRead);
  const resourceArr = allFiles.join('\n').split('resource ').splice(1).map((v) => `resource ${v}`);
  const nameToHclLut = generateNameToHclLut(tfState, resourceArr);
  const writePromises = componentArr.map(async (mod, index) => {
    const dirPath = path.join(outputDir, `mod_${index}`);
    const isDirExist = await exists(dirPath);
    if (!isDirExist) await mkdir(dirPath);
    await moduleToTfFiles(nameToHclLut, mod, dirPath);
  });
  await Promise.all(writePromises);
  const mainTfContents = mainTfGenerator(componentArr.length);
  const mainTfPath = path.join(outputDir, 'main.tf');
  await writeFile(mainTfPath, mainTfContents);
};

module.exports = {
  getValidNamesFromResource,
  getResourceForName,
  getNameFromResource,
  getNameFromId,
  generateAdjacencyMatrix,
  getAllConnectedComponentsForName,
  colorAllConnectedComponents,
  coloredComponentsTo2dArr,
  getModuleIdFromResource,
  addModuleToTfState,
  generateNameToHclLut,
  mainTfGenerator,
  modularize,
};
