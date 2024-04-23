const { resolve: resolvePath } = require('path');
const { existsSync } = require('fs');

const { resolveRootPath, ensureDirExists, copyFileDeeply, resolveSiteSrcDir } = require('../helper');

module.exports = {
  execute: (siteAlias = 'default') => {
    const rootPath = resolveRootPath();
    const themeSrcPath = `${rootPath}/node_modules/hexo-theme-lime`;

    if (!existsSync(themeSrcPath)) {
      return;
    }

    const themeDistPath = resolvePath(rootPath, resolveSiteSrcDir(siteAlias), 'themes/lime-local');

    ensureDirExists(themeDistPath);
    copyFileDeeply(themeSrcPath, themeDistPath, ['README.md', 'CHANGELOG.md', 'package.json']);
  },
};
