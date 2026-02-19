const { join: joinPath } = require('path');

const { isString, isArray } = require('@ntks/toolbox');
const { createLarkClient, logErr } = require('@knosys/ksdk-lark');
const { stringify } = require('csv-stringify/sync');

const { readDirDeeply, ensureDirExists, readData, saveData } = require('../../helper');
const { getDistRootDirPath, getDataSourceDirPath } = require('./helper');

const FIELD_NAMES = ['任务名称', '任务描述', '任务期限', '任务地点', '任务状态', '开始时间', '结束时间'];

const dashboardAppToken = 'WmySb2sQ4anOwwsBTvkcTePOndh';
const dashboardTableId = 'tblwYH0jaRmRZGvb';

let excludedBitableTokens;

async function insertDashboardTableRecords(client, params) {
  console.log('更新生活仪表盘任务汇总记录');

  const res = await client.bitable.appTableRecord.batchCreate(params);

  if (res.code !== 0) {
    logErr(res);
  }
}

async function updateDashboardTable(client, records) {
  if (records.length === 0) {
    return;
  }

  console.log('获取生活仪表盘任务汇总记录');

  const pathParams = { app_token: dashboardAppToken, table_id: dashboardTableId };

  let res = await client.bitable.appTableRecord.list({ path: pathParams, params: { page_size: 500 } });

  if (res.code === 0) {
    const oldRecordIds = (res.data.items || []).map(record => record.record_id);
    const params = { path: pathParams, data: { records } };

    if (oldRecordIds.length > 0) {
      console.log('生活仪表盘任务汇总记录 ID 为', oldRecordIds);
      console.log('删除生活仪表盘任务汇总记录');

      res = await client.bitable.appTableRecord.batchDelete({ path: pathParams, data: { records: oldRecordIds } });

      if (res.code === 0) {
        await insertDashboardTableRecords(client, params);
      } else {
        logErr(res);
      }
    } else {
      await insertDashboardTableRecords(client, params);
    }
  } else {
    logErr(res);
  }
}

function convertToCsv(tables) {
  const resolved = [];

  tables.forEach(table => {
    table.records.forEach(record => {
      resolved.push(FIELD_NAMES.map(n => record[n]).concat(table.title));
    });
  });

  resolved.unshift([].concat(FIELD_NAMES, '所属项目'));

  return stringify(resolved);
}

async function syncProjects(syncToDashboard, clientCreator) {
  const collectionDataSourcePath = joinPath(getDataSourceDirPath(), 'data/bases');
  const taskTableName = '任务管理';

  const tables = [];
  const dashboardTableRecords = [];

  readDirDeeply(collectionDataSourcePath, ['appToken'], {}, appToken => {
    const appDataSourcePath = joinPath(collectionDataSourcePath, appToken);
    const appTables = readData(joinPath(appDataSourcePath, 'tables.yml')) || [];

    if (!appTables.some(({ name }) => name === taskTableName)) {
      return;
    }

    const app = readData(joinPath(appDataSourcePath, 'basic.yml'));

    for (const table of appTables) {
      if (table.name !== taskTableName) {
        continue;
      }

      const tableId = table.table_id;
      const tableRecords = readData(joinPath(appDataSourcePath, `table_${tableId}_records.yml`)) || [];

      if (!excludedBitableTokens.includes(appToken)) {
        const records = [];

        tableRecords.forEach(({ fields }) => {
          const normalRecord = {};
          const dashboardTableRecord = {};

          FIELD_NAMES.forEach(f => {
            const v = fields[f];

            normalRecord[f] = v || '';
            dashboardTableRecord[f] = v;
          });

          records.push(normalRecord);

          if (!syncToDashboard) {
            return;
          }

          if (fields.任务名称 && fields.任务状态) {
            const stage = fields.所属阶段 || fields.所属迭代;

            dashboardTableRecord.所属项目 = app.title;
            dashboardTableRecord.所属阶段 = isArray(stage) ? stage[0].text : stage;

            dashboardTableRecords.push({ fields: dashboardTableRecord });
          }
        });

        tables.push({ id: tableId, title: app.title, app: appToken, records });
      }
    }
  });

  if (dashboardTableRecords.length > 0) {
    updateDashboardTable(clientCreator(), dashboardTableRecords);
  }

  if (tables.length > 0) {
    const distDirPath = getDistRootDirPath();

    ensureDirExists(distDirPath, true);

    saveData(`${distDirPath}/open-tasks.yml`, tables);
    saveData(`${distDirPath}/open-tasks.csv`, convertToCsv(tables));
  }
}

async function syncFromLark(
  syncToDashboard = false,
  appId = process.env.KNOSYS_LARK_INDIVIDUAL_APP_ID,
  appSecret = process.env.KNOSYS_LARK_INDIVIDUAL_APP_SECRET,
  excluded,
) {
  try {
    const clientCreator = createLarkClient.bind(null, appId, appSecret);

    excludedBitableTokens = [dashboardAppToken].concat(isString(excluded) && excluded ? excluded.split(',') : []);

    await syncProjects(['true', true].includes(syncToDashboard), clientCreator);
  } catch (err) {
    return console.error(err.message);
  }
}

module.exports = { syncFromLark };
