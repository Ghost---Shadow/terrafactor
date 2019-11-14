const fs = require('fs');
const {
  toRegexLut,
  processFile,
  filterOnlyNotIdsLut,
  varToValueLut,
  valueLutToVarFile,
  mergeLuts,
  tfStateToRegexLut,
} = require('./post-process');

const tfState = require('./test_helpers/sample.tfstate.json');

const processFileContents = fs.readFileSync('src/test_helpers/processFile-fileContents.txt').toString();
const processFileResult = fs.readFileSync('src/test_helpers/processFile-result.txt').toString();
const varFile = fs.readFileSync('src/test_helpers/valueLutToVarFile-fileString.txt').toString();

const inverseLut = {
  'ngw-1': 'alicloud_nat_gateway.gw_name_1.id',
  'ngw-2': 'alicloud_nat_gateway.gw_name_2.id',
  'ngw-3': 'alicloud_nat_gateway.gw_name_3.id',
  PostPaid: 'var.instance_charge_type_',
  name1: 'var.name_',
  Small: 'var.specification_',
};

const regexLut = {
  '"ngw\\-1"': 'alicloud_nat_gateway.gw_name_1.id',
  '"ngw\\-2"': 'alicloud_nat_gateway.gw_name_2.id',
  '"ngw\\-3"': 'alicloud_nat_gateway.gw_name_3.id',
  '"PostPaid"': 'var.instance_charge_type_',
  '"name1"': 'var.name_',
  '"Small"': 'var.specification_',
};

const fullLut = {
  'ftb-1': [
    'alicloud_nat_gateway.gw_name_1.forward_table_ids',
  ],
  'ngw-1': [
    'alicloud_nat_gateway.gw_name_1.id',
  ],
  PostPaid: [
    'alicloud_nat_gateway.gw_name_1.instance_charge_type',
    'alicloud_nat_gateway.gw_name_2.instance_charge_type',
    'alicloud_nat_gateway.gw_name_3.instance_charge_type',
  ],
  name1: [
    'alicloud_nat_gateway.gw_name_1.name',
    'alicloud_nat_gateway.gw_name_2.name',
  ],
  'stb-1': [
    'alicloud_nat_gateway.gw_name_1.snat_table_ids',
  ],
  Small: [
    'alicloud_nat_gateway.gw_name_1.specification',
    'alicloud_nat_gateway.gw_name_2.specification',
    'alicloud_nat_gateway.gw_name_3.specification',
  ],
  'vpc-1': [
    'alicloud_nat_gateway.gw_name_1.vpc_id',
  ],
  'ftb-2': [
    'alicloud_nat_gateway.gw_name_2.forward_table_ids',
  ],
  'ngw-2': [
    'alicloud_nat_gateway.gw_name_2.id',
  ],
  'stb-2': [
    'alicloud_nat_gateway.gw_name_2.snat_table_ids',
  ],
  'vpc-2': [
    'alicloud_nat_gateway.gw_name_2.vpc_id',
  ],
  'ftb-3': [
    'alicloud_nat_gateway.gw_name_3.forward_table_ids',
  ],
  'ngw-3': [
    'alicloud_nat_gateway.gw_name_3.id',
  ],
  name2: [
    'alicloud_nat_gateway.gw_name_3.name',
  ],
  'stb-3': [
    'alicloud_nat_gateway.gw_name_3.snat_table_ids',
  ],
  'vpc-3': [
    'alicloud_nat_gateway.gw_name_3.vpc_id',
  ],
};
const varLut = {
  PostPaid: [
    'alicloud_nat_gateway.gw_name_1.instance_charge_type',
    'alicloud_nat_gateway.gw_name_2.instance_charge_type',
    'alicloud_nat_gateway.gw_name_3.instance_charge_type',
  ],
  name1: [
    'alicloud_nat_gateway.gw_name_1.name',
    'alicloud_nat_gateway.gw_name_2.name',
  ],
  Small: [
    'alicloud_nat_gateway.gw_name_1.specification',
    'alicloud_nat_gateway.gw_name_2.specification',
    'alicloud_nat_gateway.gw_name_3.specification',
  ],
};
const valueLut = {
  PostPaid: 'instance_charge_type_',
  name1: 'name_',
  Small: 'specification_',
};

describe('post-process', () => {
  describe('toRegexLut', () => {
    it('should work for happy path', () => {
      const expected = regexLut;
      expect(toRegexLut(inverseLut)).toEqual(expected);
    });
  });
  describe('processFile', () => {
    it('should work for happy path', () => {
      expect(processFile(processFileContents, regexLut)).toEqual(processFileResult);
    });
  });
  describe('filterOnlyNotIdsLut', () => {
    it('should work for happy path', () => {
      const expected = varLut;
      expect(filterOnlyNotIdsLut(fullLut)).toEqual(expected);
    });
  });
  describe('varToValueLut', () => {
    it('should work for happy path', () => {
      const expected = valueLut;
      expect(varToValueLut(varLut)).toEqual(expected);
    });
  });
  describe('valueLutToVarFile', () => {
    it('should work for happy path', () => {
      expect(valueLutToVarFile(valueLut)).toEqual(varFile);
    });
  });
  describe('mergeLuts', () => {
    it('should work for happy path', () => {
      const idsLut = {
        'ngw-1': 'alicloud_nat_gateway.gw_name_1.id',
        'ngw-2': 'alicloud_nat_gateway.gw_name_2.id',
        'ngw-3': 'alicloud_nat_gateway.gw_name_3.id',
      };
      const expected = inverseLut;
      expect(mergeLuts(idsLut, valueLut)).toEqual(expected);
    });
  });
  describe('tfStateToRegexLut', () => {
    it('should work for happy path', () => {
      expect(tfStateToRegexLut(tfState)).toEqual({ regexLut, varFileString: varFile });
    });
  });
});
