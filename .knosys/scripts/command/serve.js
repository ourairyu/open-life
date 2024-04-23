const { resolve: resolvePath } = require('path');
const { pick } = require('@ntks/toolbox');

const { resolveRootPath, readData, saveData, execute, resolveSiteSrcDir } = require('../helper');

module.exports = {
  execute: (site = 'default') => {
    const rootPath = resolveRootPath();
    const pkg = readData(`${rootPath}/package.json`);
    const siteSrcPath = resolvePath(rootPath, resolveSiteSrcDir(site));

    saveData(`${siteSrcPath}/package.json`, { name: `${pkg.name}-site-${site}`, ...pick(pkg, ['version', 'private', 'hexo', 'dependencies']) });
    execute('site', 'serve', site);
  },
};
