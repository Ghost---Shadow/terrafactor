const fs = require('fs');
const {
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
} = require('./modularizer');


const tfState = require('./test_helpers/sample.tfstate.json');
const tfStateFinal = require('./test_helpers/sample_final.tfstate.json');

const mainTf = fs.readFileSync('./src/test_helpers/main.tf.sample').toString();
const allValidIds = [
  'ngw-1',
  'ngw-2',
  'ngw-3',
];
const adj = {
  'ngw-1': {
    'ngw-2': true,
    'ngw-3': true,
  },
  'ngw-2': {
    'ngw-1': true,
    'ngw-3': true,
  },
  'ngw-3': {
    'ngw-2': true,
    'ngw-1': true,
  },
};

describe('modularizer', () => {
  describe('getValidIdsForInstance', () => {
    it('should do stuff', () => {
      const instance = {
        schema_version: 0,
        attributes: {
          bandwidth_package_ids: '',
          bandwidth_packages: [],
          description: '',
          forward_table_ids: 'ftb-3',
          id: 'ngw-3',
          dummy_field: 'ngw-1',
          instance_charge_type: 'PostPaid',
          name: 'name2',
          period: null,
          snat_table_ids: 'stb-3',
          spec: null,
          specification: 'Small',
          vpc_id: 'vpc-3',
        },
      };
      const expected = ['ngw-1'];
      expect(getValidIdsForInstance(instance, allValidIds)).toEqual(expected);
    });
  });
  describe('getInstanceForId', () => {
    it('should do stuff', () => {
      const id = 'ngw-3';
      const expected = {
        schema_version: 0,
        attributes: {
          bandwidth_package_ids: '',
          bandwidth_packages: [],
          description: '',
          forward_table_ids: 'ftb-3',
          id: 'ngw-3',
          dummy_field: 'ngw-1',
          instance_charge_type: 'PostPaid',
          name: 'name2',
          period: null,
          snat_table_ids: 'stb-3',
          spec: null,
          specification: 'Small',
          vpc_id: 'vpc-3',
        },
      };
      expect(getInstanceForId(tfState, id)).toEqual(expected);
    });
  });
  describe('generateAdjacencyMatrix', () => {
    it('should do stuff', () => {
      const expected = adj;
      expect(generateAdjacencyMatrix(tfState, allValidIds)).toEqual(expected);
    });
  });
  describe('getAllConnectedComponentsForId', () => {
    it('should do stuff', () => {
      const visited = {
        'ngw-1': 1,
        'ngw-2': 1,
        'ngw-3': false,
      };
      const color = 1;
      const id = 'ngw-3';
      const expected = {
        'ngw-1': 1,
        'ngw-2': 1,
        'ngw-3': 1,
      };
      expect(getAllConnectedComponentsForId(tfState,
        allValidIds,
        adj,
        visited,
        color,
        id)).toEqual(expected);
    });
  });
  describe('colorAllConnectedComponents', () => {
    it('should do stuff', () => {
      const expected = {
        'ngw-1': 1,
        'ngw-2': 1,
        'ngw-3': 1,
      };
      expect(colorAllConnectedComponents(tfState, allValidIds, adj)).toEqual(expected);
    });
  });
  describe('coloredComponentsTo2dArr', () => {
    it('should do stuff', () => {
      const coloredComponents = {
        'ngw-1': 1,
        'ngw-2': 1,
        'ngw-3': 1,
      };
      const expected = [[], ['ngw-1', 'ngw-2', 'ngw-3']];
      expect(coloredComponentsTo2dArr(coloredComponents)).toEqual(expected);
    });
  });
  describe('getModuleIdFromResource', () => {
    it('should do stuff', () => {
      const componentArr = [
        [],
        [
          'ngw-1',
          'ngw-2',
          'ngw-3',
        ],
      ];
      const resource = {
        mode: 'managed',
        type: 'alicloud_nat_gateway',
        name: 'gw_name_3',
        provider: 'provider.alicloud',
        instances: [
          {
            schema_version: 0,
            attributes: {
              bandwidth_package_ids: '',
              bandwidth_packages: [],
              description: '',
              forward_table_ids: 'ftb-3',
              id: 'ngw-3',
              dummy_field: 'ngw-1',
              instance_charge_type: 'PostPaid',
              name: 'name2',
              period: null,
              snat_table_ids: 'stb-3',
              spec: null,
              specification: 'Small',
              vpc_id: 'vpc-3',
            },
          },
        ],
      };
      const expected = 1;
      expect(getModuleIdFromResource(componentArr, resource)).toEqual(expected);
    });
  });
  describe('addModuleToTfState', () => {
    it('should do stuff', () => {
      const componentArr = [[], ['ngw-1', 'ngw-2', 'ngw-3']];
      const expected = tfStateFinal;
      expect(addModuleToTfState(tfState, componentArr)).toEqual(expected);
    });
  });
  describe('findIdForHcl', () => {
    it('should do stuff', () => {
      const hclArray = [
        'resource "alicloud_nat_gateway" "gw_name_1" {\n  instance_charge_type = "PostPaid"\n  name                 = "name1"\n  specification        = "Small"\n  vpc_id               = "vpc-1"\n}\n\n',
        'resource "alicloud_nat_gateway" "gw_name_2" {\n  instance_charge_type = "PostPaid"\n  name                 = "name1"\n  specification        = "Small"\n  vpc_id               = "vpc-2"\n}\n\n',
        'resource "alicloud_nat_gateway" "gw_name_3" {\n  instance_charge_type = "PostPaid"\n  name                 = "name2"\n  specification        = "Small"\n  vpc_id               = "vpc-3"\n}\n',
      ];
      const expected = {
        'ngw-1': 'resource "alicloud_nat_gateway" "gw_name_1" {\n  instance_charge_type = "PostPaid"\n  name                 = "name1"\n  specification        = "Small"\n  vpc_id               = "vpc-1"\n}\n\n',
        'ngw-2': 'resource "alicloud_nat_gateway" "gw_name_2" {\n  instance_charge_type = "PostPaid"\n  name                 = "name1"\n  specification        = "Small"\n  vpc_id               = "vpc-2"\n}\n\n',
        'ngw-3': 'resource "alicloud_nat_gateway" "gw_name_3" {\n  instance_charge_type = "PostPaid"\n  name                 = "name2"\n  specification        = "Small"\n  vpc_id               = "vpc-3"\n}\n',
      };
      expect(findIdForHcl(tfState, hclArray)).toEqual(expected);
    });
  });
  describe('mainTfGenerator', () => {
    it('should do stuff', () => {
      const numModules = 2;
      expect(mainTfGenerator(numModules)).toEqual(mainTf);
    });
  });
});
