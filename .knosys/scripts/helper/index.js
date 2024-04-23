const { resolve: resolvePath } = require('path');
const { pick } = require('@ntks/toolbox');

const ksUtils = require('./knosys');

function resolveSiteSrcDir(site) {
  return ksUtils.getConfig(`site.${site}.source`) || `./.knosys/sites/${site}`;
}

function copySitePkgInfo(site) {
  const rootPath = ksUtils.resolveRootPath();
  const pkg = ksUtils.readData(`${rootPath}/package.json`);
  const siteSrcPath = resolvePath(rootPath, resolveSiteSrcDir(site));

  ksUtils.saveData(`${siteSrcPath}/package.json`, { name: `${pkg.name}-site-${site}`, ...pick(pkg, ['version', 'private', 'hexo', 'dependencies']) });
}

module.exports = { ...ksUtils, resolveSiteSrcDir, copySitePkgInfo };
