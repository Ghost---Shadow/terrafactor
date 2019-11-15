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

const tfState = require('./test_helpers/initial.tfstate.json');
const inverseLut = require('./test_helpers/inverseLut.json');
const regexLut = require('./test_helpers/regexLut.json');
const valueLut = require('./test_helpers/valueLut.json');
const idsLut = require('./test_helpers/idsLut.json');
const varLut = require('./test_helpers/varLut.json');
const fullLut = require('./test_helpers/fullLut.json');

const processFileContents = fs.readFileSync('src/test_helpers/processFile-fileContents.txt').toString();
const processFileResult = fs.readFileSync('src/test_helpers/processFile-result.txt').toString();
const varFile = fs.readFileSync('src/test_helpers/valueLutToVarFile-fileString.txt').toString();

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
