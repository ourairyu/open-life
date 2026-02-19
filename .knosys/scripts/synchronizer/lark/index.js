const { syncFromLark: syncIndividualTasksFromLark } = require('./task');

const handlerMap = {
  task: syncIndividualTasksFromLark,
};

module.exports = {
  syncFromLark: (type, ...args) => {
    handlerMap[type] && handlerMap[type](...args);
  },
};
