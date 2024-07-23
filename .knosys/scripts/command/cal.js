const { resolve: resolvePath } = require('path');
const { existsSync } = require('fs');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const ics = require('ics');

const { resolveRootPath, readData, saveData } = require('../helper');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Shanghai');

function ensureTimezone(raw) {
  return dayjs(raw).subtract(8, 'h').add(1, 'd').valueOf();
}

function isZeroTime(timeObj) {
  return timeObj.hour() === 0 && timeObj.minute() === 0 && timeObj.second() === 0
}

function generateCalendar(data) {
  const descriptors = [];

  data.forEach(table => {
    table.records.forEach(record => {
      let startTime = record.开始时间;
      let endTime = record.结束时间 || startTime;

      if (!record.任务名称 || !startTime || !['未开始', '进行中'].includes(record.任务状态)) {
        return;
      }

      const startTimeObj = dayjs(startTime);
      const endTimeObj = dayjs(endTime);

      if (endTimeObj.isSame(startTimeObj) && isZeroTime(startTimeObj)) {
        startTime = startTimeObj.startOf('day').valueOf();
        endTime = endTimeObj.endOf('day').valueOf();
      } else {
        startTime = startTimeObj.valueOf();

        if (isZeroTime(endTimeObj)) {
          endTime = endTimeObj.subtract(1, 'day').endOf('day').valueOf();
        } else {
          endTime = endTimeObj.valueOf();
        }
      }

      descriptors.push({
        calName: '欧雷的开放生活',
        productId: 'o.ourai.ws',
        title: record.任务名称,
        description: record.任务描述 || '',
        start: ensureTimezone(startTime),
        startInputType: 'utc',
        startOutputType: 'utc',
        end: ensureTimezone(endTime),
        endInputType: 'utc',
        endOutputType: 'utc',
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
