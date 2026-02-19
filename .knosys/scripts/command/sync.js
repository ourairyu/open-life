const { syncFromLark } = require('../synchronizer');

const syncers = {
  lark: syncFromLark,
};

module.exports = {
  execute: (platform, ...args) => {
    const sync = syncers[platform];

    if (!sync) {
      return console.log(`[SYNC ERROR] synchronizer for \`${platform}\` doesn't exist`);
    }

    sync(...args);
  }
};
