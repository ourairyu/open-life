const ksUtils = require('./knosys');

function resolveSiteSrcDir(site) {
  return ksUtils.getConfig(`site.${site}.source`) || `./.knosys/sites/${site}`;
}

module.exports = { ...ksUtils, resolveSiteSrcDir };
