const { resolve: resolvePath } = require('path');
const { existsSync } = require('fs');
const { execSync } = require('child_process');
const { generateHexoSite } = require('@knosys/sdk/src/site/generators/hexo');

const { resolveRootPath, getConfig, resolveSiteSrcDir, copySitePkgInfo, execute } = require('../helper');

module.exports = {
  execute: distDir => {
    if (distDir) {
      const distPath = resolvePath(resolveRootPath(), distDir);

      if (existsSync(distPath)) {
        const site = 'default';
        const cnameDomain = getConfig(`site.${site}.cname`);

        copySitePkgInfo(site);
        generateHexoSite(resolveSiteSrcDir(site), distPath);

        if (cnameDomain) {
          execSync(`echo ${cnameDomain} > CNAME`, { stdio: 'inherit', cwd: distPath });
        }
      } else {
        console.log(`[ERROR] 路径 \`${distPath}\` 不存在`);
      }
    } else {
      execute('site', 'deploy', 'default');
    }
  }
};
