const { join: joinPath } = require('path');

const { createLarkClient, logErr } = require('@larknosys/sdk');

const { readDirDeeply, ensureDirExists, readEntity, saveData } = require('../../helper');
const { getDistRootDirPath, getDataSourceDirPath } = require('./helper');

const taskFieldDefs = [
  { label: '任务名称', name: 'title' },
  { label: '任务描述', name: 'description' },
  { label: '任务期限', name: 'deadline' },
  { label: '任务地点', name: 'location' },
  { label: '任务状态', name: 'status' },
  { label: '开始时间', name: 'startTime' },
  { label: '结束时间', name: 'endTime' },
];


const statusMap = {
  todo: '未开始',
  wip: '进行中',
  done: '已结束',
  terminated: '已终止',
};

const dashboardAppToken = 'WmySb2sQ4anOwwsBTvkcTePOndh';
const dashboardTableId = 'tblwYH0jaRmRZGvb';

const maxDeleteCount = 500;
const maxInsertCount = 1000;

async function deleteDashboardTableRecords(client, params) {
  const { records } = params.data;
  const total = records.length;

  console.log(`删除生活仪表盘任务汇总记录，共 ${total} 条`);

  let times = Math.ceil(total / maxDeleteCount);
  let startAt = 0;
  let endAt = maxDeleteCount;

  let res;

  while (times > 0) {
    console.log(`正在删除第 ${startAt + 1} 到 ${Math.min(endAt, total)} 条记录`);
    res = await client.bitable.appTableRecord.batchDelete({
      ...params,
      data: {
        ...params.data,
        records: records.slice(startAt, endAt),
      },
    });

    if (res.code !== 0) {
      logErr(res);
      break;
    }

    console.log(`第 ${startAt + 1} 到 ${Math.min(endAt, total)} 条记录删除成功`);

    times--;
    startAt += maxDeleteCount;
    endAt += maxDeleteCount;
  }

  return res;
}

async function insertDashboardTableRecords(client, params) {
  const { records } = params.data;
  const total = records.length;

  console.log(`更新生活仪表盘任务汇总记录，共 ${total} 条`);

  let times = Math.ceil(total / maxInsertCount);
  let startAt = 0;
  let endAt = maxInsertCount;

  let res;

  while (times > 0) {
    console.log(`正在插入第 ${startAt + 1} 到 ${Math.min(endAt, total)} 条记录`);
    res = await client.bitable.appTableRecord.batchCreate({
      ...params,
      data: {
        ...params.data,
        records: records.slice(startAt, endAt),
      },
    });

    if (res.code !== 0) {
      logErr(res);
      break;
    }

    console.log(`第 ${startAt + 1} 到 ${Math.min(endAt, total)} 条记录插入成功`);

    times--;
    startAt += maxInsertCount;
    endAt += maxInsertCount;
  }

  return res;
}

async function updateDashboardTable(client, records) {
  if (records.length === 0) {
    return;
  }

  console.log('获取生活仪表盘任务汇总记录');

  const pathParams = { app_token: dashboardAppToken, table_id: dashboardTableId };

  const fetchRecords = async (page_token) => {
    const params = { page_size: 500 };

    if (page_token) {
      params.page_token = page_token;
    }

    return client.bitable.appTableRecord.list({ path: pathParams, params });
  };

  let res = await fetchRecords();

  if (res.code === 0) {
    const oldRecordIds = [];

    if (res.data.total > 0) {
      oldRecordIds.push(...(res.data.items || []).map(record => record.record_id));

      while (res.data.has_more) {
        res = await fetchRecords(res.data.page_token);

        if (res.code === 0) {
          oldRecordIds.push(...(res.data.items || []).map(record => record.record_id));
        } else {
          break;
        }
      }
    }

    const params = { path: pathParams, data: { records } };

    if (oldRecordIds.length > 0) {
      console.log('生活仪表盘任务汇总记录 ID 为', oldRecordIds);

      res = await deleteDashboardTableRecords(client, { path: pathParams, data: { records: oldRecordIds } });

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

async function syncProjects(syncToDashboard, clientCreator) {
  const localDataDirPath = joinPath(getDataSourceDirPath(), 'data');
  const collectionDataSourcePath = joinPath(localDataDirPath, 'projects');

  const tables = [];
  const dashboardTableRecords = [];

  readDirDeeply(collectionDataSourcePath, ['appToken'], {}, appToken => {
    const projectDirPath = joinPath(collectionDataSourcePath, appToken);
    const project = readEntity(projectDirPath);

    if (!project.belongsTo || !project.tasks) {
      return;
    }

    const thing = readEntity(joinPath(localDataDirPath, 'things', project.belongsTo));

    const records = [];

    project.tasks.forEach(task => {
      const normalRecord = {};
      const dashboardTableRecord = {};

      taskFieldDefs.forEach(f => {
        let v = task[f.name];

        if (f.name === 'status' && v) {
          v = statusMap[v];
        }

        normalRecord[f.label] = v || '';
        dashboardTableRecord[f.label] = v;
      });

      records.push(normalRecord);

      if (!syncToDashboard) {
        return;
      }

      if (task.title && task.status) {
        dashboardTableRecord.所属项目 = thing.title;
        dashboardTableRecord.所属阶段 = project.title;

        dashboardTableRecords.push({ fields: dashboardTableRecord });
      }
    });

    tables.push({ records });
  });

  if (dashboardTableRecords.length > 0) {
    updateDashboardTable(clientCreator(), dashboardTableRecords);
  }

  if (tables.length > 0) {
    const distDirPath = getDistRootDirPath();

    ensureDirExists(distDirPath, true);

    saveData(`${distDirPath}/open-tasks.yml`, tables);
  }
}

async function syncFromLark(
  syncToDashboard = false,
  appId = process.env.KNOSYS_LARK_INDIVIDUAL_APP_ID,
  appSecret = process.env.KNOSYS_LARK_INDIVIDUAL_APP_SECRET,
) {
  try {
    const clientCreator = createLarkClient.bind(null, appId, appSecret);

    await syncProjects(['true', true].includes(syncToDashboard), clientCreator);
  } catch (err) {
    return console.error(err.message);
  }
}

module.exports = { syncFromLark };
