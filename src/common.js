const _ = require('lodash');

const arrayLike = (acc, key, val) => {
  if (acc[key] === undefined) {
    acc[key] = [val];
    return acc;
  }
  acc[key].push(val);
  return acc;
};

const customMerge = (obj1, obj2) => Object.keys(obj2)
  .reduce((acc, key) => {
    if (acc[key] !== undefined) {
      acc[key] = acc[key].concat(obj2[key]);
      return acc;
    }
    acc[key] = obj2[key];
    return acc;
  }, obj1);

const attributeReducerFunctor = (resource, instance) => (lutAcc, key) => {
  const target = `${resource.type}.${resource.name}.${key}`;
  const value = instance.attributes[key];
  return arrayLike(lutAcc, value, target);
};

const getValidKeys = (attributes) => {
  // Pick only non empty string like attributes
  const nonNullStrings = Object.keys(attributes)
    .filter(((key) => _.isString(attributes[key])))
    .filter(((key) => !_.isEmpty(attributes[key])));

  // TODO: Find a more robust solution
  // Remove self references
  const counterLut = nonNullStrings.reduce((acc, key) => {
    acc[attributes[key]] = acc[attributes[key]] === undefined
      ? { key, count: 1 } : { key, count: acc[attributes[key]].count + 1 };
    return acc;
  }, {});

  return Object.keys(counterLut)
    .filter((key) => counterLut[key].count === 1)
    .map((key) => counterLut[key].key);
};

const instanceReducerFunctor = (resource) => (instanceAcc, instance) => {
  const validKeys = getValidKeys(instance.attributes);
  const inverseLutForInstance = validKeys.reduce(attributeReducerFunctor(resource, instance), {});
  return customMerge(instanceAcc, inverseLutForInstance);
};

const resourceReducerFunctor = () => (resourcesAcc, resource) => {
  const totalLut = resource.instances.reduce(instanceReducerFunctor(resource), {});
  return customMerge(resourcesAcc, totalLut);
};

const genInverseLut = (resources) => resources.reduce(resourceReducerFunctor(), {});

const filterOnlyIdsLut = (lut) => Object.keys(lut).reduce((acc, key) => {
  const id = lut[key].filter((maybeId) => maybeId.endsWith('.id'))[0];
  if (id) return { ...acc, [key]: id };
  return acc;
}, {});

module.exports = {
  genInverseLut,
  filterOnlyIdsLut,
};
