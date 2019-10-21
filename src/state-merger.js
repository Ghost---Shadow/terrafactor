const merge = require('lodash.merge');

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
      merged[path] = merge(merged[path], m);
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

const mergeStatesV4 = (allStates) => allStates
  .reduce((acc, next) => (
    merge(
      next,
      {
        outputs: merge(acc.outputs, next.outputs),
        resources: acc.resources
          ? acc.resources.concat(next.resources)
          : next.resources,
      },
    )), { });

module.exports = {
  mergeStatesV4,
  mergeStatesV3,
};
