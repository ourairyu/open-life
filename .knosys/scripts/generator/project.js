const { noop, pick } = require('@ntks/toolbox');

const { sortByDate, readData, readMetadata } = require('../helper');
const { getItemSourceDir, createGenerator } = require('./helper');

const collectionName = 'projects';

function resolveItemData(sourceRootPath, id, item) {
  const sourceDir = getItemSourceDir(sourceRootPath, item);
  const project = { ...readMetadata(sourceDir), id };
  const sharedMetadata = readData(`${sourceDir}/.meta/shared.yml`) || {};

  if (sharedMetadata.date) {
    project.sharedAt = sharedMetadata.date;
  }

  if (Array.isArray(project.tasks)) {
    project.tasks = project.tasks.map(task => ({ ...task, status: task.status || 'waiting' }));
  }

  return pick(project, ['id', 'title', 'description', 'date', 'tags', 'period', 'git', 'links', 'tasks', 'share', 'sharedAt']);
}

module.exports = {
  createProjectGenerator: (sourceRootPath, sharedRootPath) => createGenerator(sharedRootPath, collectionName, {
    getItemImageSourceDir: getItemSourceDir.bind(null, sourceRootPath),
    transformItem: resolveItemData.bind(null, sourceRootPath),
    transformData: items => {
      const sequence = sortByDate(Object.keys(items).map(key => items[key])).map(({ id }) => id);
      const yearly = {};

      sequence.forEach(id => {
        const year = items[id].date.substr(0, 4);

        if (!yearly[year]) {
          yearly[year] = [];
        }

        yearly[year].push(id);
      });

      return { items, sequence, yearly: Object.keys(yearly).sort().map(year => ({ year, ids: yearly[year] })) };
    },
    readEach: noop,
  }),
};
