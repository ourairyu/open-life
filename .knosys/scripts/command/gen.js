const { resolve: resolvePath } = require('path');

const { resolveRootPath, ensureDirExists, getLocalDataRoot, getLocalDocRoot } = require('../helper');
const { createOkrGenerator } = require('../generator');

module.exports = {
  execute: () => {
    [getLocalDataRoot(), getLocalDocRoot()].forEach(distPath => ensureDirExists(distPath, true));

    const sourceRootPath = resolvePath(resolveRootPath(), 'data');

    const generators = {
      okr: createOkrGenerator(sourceRootPath),
    };

    Object.values(generators).forEach(generator => generator());
  },
};
