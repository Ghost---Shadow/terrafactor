const _ = require('lodash');

// Borrowed with love from
// https://github.com/mmalecki/terraform-state-merge/blob/master/bin/terraform-state-merge
const mergeStatesV3 = (unsortedJsons) => {
  // Sort them. We can assume that if Terraform changed some resources in between
  // our serials, the latest serial is the most up to date one.
  const jsons = unsortedJsons.sort((a, b) => a.serial - b.serial);
  const modules = jsons.map((j) => j.modules);

  let merged = {};

  function stash(modulesInner) {
    modulesInner.forEach((m) => {
      const path = m.path.join('.');
      merged[path] = _.merge(merged[path], m);
    });
  }

  modules.forEach(stash);

  merged = Object.keys(merged).map((k) => merged[k]);
  return {
    version: jsons[jsons.length - 1].version,
    terraform_version: jsons[jsons.length - 1].terraform_version,
    serial: jsons[jsons.length - 1].serial + 1,
    modules: merged,
  };
};

const mergeStatesV4 = (allStates) => {
  const matcherFunction = (resource) => `${resource.type}.${resource.name}`;

  const mergedState = allStates
    .reduce((acc, next) => ({
      ...acc,
      outputs: _.merge(acc.outputs, next.outputs),
      resources: _.unionBy(acc.resources, next.resources, matcherFunction),
    }), {
      version: 4,
      terraform_version: allStates[0].terraform_version,
      serial: 1,
      lineage: '',
    });

  mergedState.outputs = Object.keys(mergedState.outputs).sort()
    .reduce((acc, next) => ({ ...acc, [next]: mergedState.outputs[next] }), {});

  mergedState.resources = mergedState.resources
    .sort((resource1, resource2) => {
      const keys = ['mode', 'type', 'name'];
      for (let i = 0; i < keys.length; i += 1) {
        const cmp = resource1[keys[i]].localeCompare(resource2[keys[i]]);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

  return mergedState;
};

module.exports = {
  mergeStatesV4,
  mergeStatesV3,
};
