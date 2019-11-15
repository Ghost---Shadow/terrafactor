const fs = require('fs');
const {
  getValidNamesFromResource,
  getResourceForName,
  generateAdjacencyMatrix,
  getAllConnectedComponentsForName,
  colorAllConnectedComponents,
  coloredComponentsTo2dArr,
  getModuleIdFromResource,
  addModuleToTfState,
  generateNameToHclLut,
  mainTfGenerator,
  getNameFromResource,
  getNameFromId,
} = require('./modularizer');

const tfState = require('./test_helpers/initial.tfstate.json');
const tfStateFinal = require('./test_helpers/final.tfstate.json');
const allValidIds = require('./test_helpers/allValidIds.json');
const allNames = require('./test_helpers/allNames.json');
const adj = require('./test_helpers/adj.json');
const visited = require('./test_helpers/visited.json');
const moduleArr = require('./test_helpers/moduleArr.json');
const hclArray = require('./test_helpers/hclArray.json');
const hclLut = require('./test_helpers/hclLut.json');

const mainTf = fs.readFileSync('./src/test_helpers/mainTfGenerator-result.txt').toString();

describe('modularizer', () => {
  describe('getNameFromId', () => {
    it('should work for happy path', () => {
      const { id } = tfState.resources[0].instances[0].attributes;
      const name = getNameFromResource(tfState.resources[0]);
      expect(getNameFromId(tfState, id)).toEqual(name);
    });
  });
  describe('getValidNamesFromResource', () => {
    it('should work for happy path', () => {
      const resource = tfState.resources[0];
      const expected = [getNameFromResource(tfState.resources[1])];
      expect(getValidNamesFromResource(tfState, resource, allValidIds, allNames)).toEqual(expected);
    });
  });
  describe('getResourceForName', () => {
    it('should work for happy path', () => {
      const name = 'provider.alicloud.alicloud_nat_gateway.gw_name_3';
      const expected = tfState.resources[2];
      expect(getResourceForName(tfState, name)).toEqual(expected);
    });
  });
  describe('generateAdjacencyMatrix', () => {
    it('should work for happy path', () => {
      const expected = adj;
      expect(generateAdjacencyMatrix(tfState, allValidIds, allNames)).toEqual(expected);
    });
  });
  describe('getAllConnectedComponentsForName', () => {
    it('should work for happy path', () => {
      const visitedBefore = {
        'provider.alicloud.alicloud_nat_gateway.gw_name_1': false,
        'provider.alicloud.alicloud_nat_gateway.gw_name_2': false,
        'provider.alicloud.alicloud_nat_gateway.gw_name_3': false,
      };
      const color = 1;
      const name = 'provider.alicloud.alicloud_nat_gateway.gw_name_1';
      const expected = visited;
      expect(getAllConnectedComponentsForName(tfState,
        allNames,
        adj,
        visitedBefore,
        color,
        name)).toEqual(expected);
    });
  });
  describe('colorAllConnectedComponents', () => {
    it('should work for happy path', () => {
      const expected = visited;
      expect(colorAllConnectedComponents(tfState, allNames, adj)).toEqual(expected);
    });
  });
  describe('coloredComponentsTo2dArr', () => {
    it('should work for happy path', () => {
      const coloredComponents = visited;
      const expected = moduleArr;
      expect(coloredComponentsTo2dArr(coloredComponents)).toEqual(expected);
    });
  });
  describe('getModuleIdFromResource', () => {
    it('should work for happy path', () => {
      const componentArr = moduleArr;
      const resource = tfState.resources[2];
      const expected = 1;
      expect(getModuleIdFromResource(componentArr, resource)).toEqual(expected);
    });
  });
  describe('addModuleToTfState', () => {
    it('should work for happy path', () => {
      const componentArr = moduleArr;
      const expected = tfStateFinal;
      expect(addModuleToTfState(tfState, componentArr)).toEqual(expected);
    });
  });
  describe('generateNameToHclLut', () => {
    it('should work for happy path', () => {
      const expected = hclLut;
      expect(generateNameToHclLut(tfState, hclArray)).toEqual(expected);
    });
  });
  describe('mainTfGenerator', () => {
    it('should work for happy path', () => {
      const numModules = 2;
      expect(mainTfGenerator(numModules)).toEqual(mainTf);
    });
  });
});
