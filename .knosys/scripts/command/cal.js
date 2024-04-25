const { resolve: resolvePath } = require('path');
const { existsSync } = require('fs');
const ics = require('ics');

const { resolveRootPath, readData, saveData } = require('../helper');

function generateCalendar(data) {
  const descriptors = [];

  data.forEach(table => {
    table.records.forEach(record => {
      if (!record.任务名称 || !record.开始时间 || !['未开始', '进行中'].includes(record.任务状态)) {
        return;
      }

      descriptors.push({
        calName: '欧雷的开放生活',
        productId: 'o.ourai.ws',
        title: record.任务名称,
        description: record.任务描述 || '',
        start: record.开始时间,
        startInputType: 'utc',
        end: record.结束时间 || record.开始时间,
        endInputType: 'utc',
        status: record.任务状态 === '进行中' ? 'CONFIRMED' : 'TENTATIVE'
      });
    });
  });

  const { error, value } = ics.createEvents(descriptors);

  if (error) {
    return console.log(`[GEN ICS ERROR] ${error}`);
  }

  saveData(`${resolveRootPath()}/schedule.ics`, value);
}

module.exports = {
  execute: dataSource => {
    const srcPath = resolvePath(resolveRootPath(), dataSource);

    if (!existsSync(srcPath)) {
      return;
    }

    generateCalendar(readData(srcPath));
  },
};
