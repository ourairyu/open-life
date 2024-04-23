const { copySitePkgInfo, execute } = require('../helper');

module.exports = {
  execute: (site = 'default') => {
    copySitePkgInfo(site);
    execute('site', 'serve', site);
  },
};
