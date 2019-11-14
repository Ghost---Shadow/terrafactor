const fs = require('fs');
const util = require('util');
const path = require('path');
const _ = require('lodash');
const flatten = require('flat');

const { genInverseLut, filterOnlyIdsLut } = require('./common');

const readFile = util.promisify(fs.readFile);
const exists = util.promisify(fs.exists);
const mkdir = util.promisify(fs.mkdir);
const readdir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);

// There must be greater than MIN_MODULE_SIZE connected components to be considered a module
const MIN_MODULE_SIZE = 2;

const getValidIdsForInstance = (instance, allValidIds) => {
  const flatAttributes = flatten(instance.attributes);
  const attributeKeys = Object.keys(flatAttributes);
  const attributeWithIdAsValue = attributeKeys
    .filter((k) => allValidIds.indexOf(flatAttributes[k]) > -1);
  const filteredOutSelfReference = attributeWithIdAsValue.filter((k) => k !== 'id');
  const result = filteredOutSelfReference.map((k) => flatAttributes[k]);
  return result;
};

const getInstanceForId = (tfState, id) => {
  const result = tfState.resources
    .filter((resource) => _.get(resource, 'instances[0].attributes.id') === id)[0].instances[0];
  return result;
};

const generateAdjacencyMatrix = (tfState, allValidIds) => {
  const adj = {};
  for (let i = 0; i < allValidIds.length; i += 1) {
    const from = allValidIds[i];
    const fromInstance = getInstanceForId(tfState, from);
    const toIds = getValidIdsForInstance(fromInstance, allValidIds);
    for (let j = 0; j < toIds.length; j += 1) {
      const to = toIds[j];
      if (adj[from] === undefined) adj[from] = {};
      if (adj[to] === undefined) adj[to] = {};
      adj[from][to] = true;
      adj[to][from] = true;
    }
  }
  return adj;
};

const getAllConnectedComponentsForId = (tfState, allValidIds, adj, visited, color, id) => {
  if (visited[id]) {
    return visited;
  }
  const newVisited = _.merge(visited, { [id]: color });

  // If component isnt connected to anything then do nothing
  if (adj[id] === undefined) return newVisited;
  const childIds = Object.keys(adj[id]);

  const result = childIds
    .reduce((runningVisited, childId) => getAllConnectedComponentsForId(
      tfState,
      allValidIds,
      adj,
      runningVisited,
      color,
      childId,
    ),
    newVisited);

  return result;
};

const colorAllConnectedComponents = (tfState, allValidIds, adj) => {
  let visited = allValidIds.reduce((acc, k) => ({ ...acc, [k]: false }), {});
  let color = 0;

  for (let i = 0; i < allValidIds.length; i += 1) {
    if (!visited[allValidIds[i]]) { color += 1; }
    visited = getAllConnectedComponentsForId(tfState,
      allValidIds,
      adj,
      visited,
      color,
      allValidIds[i]);
  }

  return visited;
};

const coloredComponentsTo2dArr = (coloredComponents) => {
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

  return modules;
};

const getModuleIdFromResource = (componentArr, resource) => {
  const { id } = resource.instances[0].attributes;
  for (let i = 0; i < componentArr.length; i += 1) {
    if (componentArr[i].indexOf(id) > -1) {
      return i;
    }
  }
  return 0;
};

const addModuleToTfState = (tfState, componentArr) => {
  const tfs = _.cloneDeep(tfState);

  for (let r = 0; r < tfs.resources.length; r += 1) {
    const moduleId = getModuleIdFromResource(componentArr, tfs.resources[r]);
    tfs.resources[r].module = `module.mod_${moduleId}`;
  }

  return tfs;
};

const findIdForHcl = (tfState, hclArray) => {
  const names = hclArray.map((res) => res.match(/resource "\S+" "(.*)"/)[1]);
  const alignedResources = names.map((name) => _.find(tfState.resources, { name }));
  const result = alignedResources.reduce((acc, resource, index) => ({
    ...acc,
    [resource.instances[0].attributes.id]: hclArray[index],
  }), {});

  return result;
};

const mainTfGenerator = (numModules) => {
  const result = [...Array(numModules)]
    .reduce((acc, next, index) => `
${acc}
module "mod_${index}" {
  source = "./mod_${index}"
}
`, '');
  return result;
};

const modularize = async (generatedDir, outputDir) => {
  const statePath = path.join(generatedDir, 'terraform.tfstate');
  const tfState = JSON.parse((await readFile(statePath)).toString());
  if (tfState.version !== 4) {
    console.error('Only tfstate version 4 is supported');
    process.exit(1);
  }

  const { resources } = tfState;
  const inverseLut = genInverseLut(resources);
  const idsToNameLut = filterOnlyIdsLut(inverseLut);
  const allValidIds = Object.keys(idsToNameLut);
  const adj = generateAdjacencyMatrix(tfState, allValidIds);
  const coloredComponents = colorAllConnectedComponents(tfState, allValidIds, adj);
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
  const idToHclLut = findIdForHcl(tfState, resourceArr);
  const writePromises = componentArr.map(async (mod, index) => {
    const dirPath = path.join(outputDir, `mod_${index}`);
    const isDirExist = await exists(dirPath);
    if (!isDirExist) await mkdir(dirPath);
    const tfFilePath = path.join(dirPath, 'flat.tf');
    const tfFileContent = mod.reduce((acc, id) => `${acc}${idToHclLut[id]}`, '');
    await writeFile(tfFilePath, tfFileContent);
  });
  await Promise.all(writePromises);
  const mainTfContents = mainTfGenerator(componentArr.length);
  const mainTfPath = path.join(outputDir, 'main.tf');
  await writeFile(mainTfPath, mainTfContents);
};

module.exports = {
  getValidIdsForInstance,
  getInstanceForId,
  generateAdjacencyMatrix,
  getAllConnectedComponentsForId,
  colorAllConnectedComponents,
  coloredComponentsTo2dArr,
  getModuleIdFromResource,
  addModuleToTfState,
  findIdForHcl,
  mainTfGenerator,
  modularize,
};
