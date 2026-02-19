const { resolve: resolvePath } = require('path');

const { resolveRootPath } = require('../../helper');

const distDirPath = `${resolveRootPath()}/.knosys/caches/sync`;

function getDistRootDirPath() {
  return distDirPath;
}

function getDataSourceDirPath() {
  return resolvePath(resolveRootPath(), process.env.KNOSYS_LARK_BACKUP_DATA_SOURCE);
}

module.exports = { getDistRootDirPath, getDataSourceDirPath };
