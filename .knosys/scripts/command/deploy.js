const { resolve: resolvePath } = require('path');
const { existsSync } = require('fs');
const { generateHexoSite } = require('@knosys/sdk/src/site/generators/hexo');

const { resolveRootPath, resolveSiteSrcDir, copySitePkgInfo, execute } = require('../helper');

module.exports = {
  execute: distDir => {
    if (distDir) {
      const distPath = resolvePath(resolveRootPath(), distDir);

      if (existsSync(distPath)) {
        copySitePkgInfo('default');
        generateHexoSite(resolveSiteSrcDir(), distPath);
      } else {
        console.log(`[ERROR] 路径 \`${distPath}\` 不存在`);
      }
    } else {
      execute('site', 'deploy', 'default');
    }
  }
};
