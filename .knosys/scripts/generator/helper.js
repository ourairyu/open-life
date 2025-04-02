const { existsSync } = require('fs');

const { noop } = require('@ntks/toolbox');
const { dump } = require('js-yaml');

const {
  rm, cp,
  getImageFileNames, readDirDeeply,
  ensureDirExists, ensureFileExists,
  readData, saveData,
  getLocalDataRoot, getLocalDocRoot,
} = require('../helper');

const METADATA_IMAGE_KEYS = ['banner', 'avatar', 'thumbnail', 'cover', 'logo'];

function getItemSourceDir(sourceRootPath, metadata) {
  return `${sourceRootPath}/${metadata.source}`;
}

function cacheClassifyItems(cache, slug, { date, categories, tags }) {
  [
    { items: categories || [], cacheKey: 'categorized' },
    { items: tags || [], cacheKey: 'tagged' },
  ].forEach(({ items, cacheKey }) => {
    items.forEach(item => {
      if (!cache[cacheKey][item]) {
        cache[cacheKey][item] = [];
      }

      cache[cacheKey][item].push({ id: slug, date });
    });
  });
}

function getCollectionRoot(collectionName) {
  return `${getLocalDocRoot()}/${collectionName}`;
}

function createBeforeReadHook(collectionName) {
  const collectionRoot = getCollectionRoot(collectionName);

  return cache => {
    cache.categorized = {};
    cache.tagged = {};

    ensureDirExists(collectionRoot);
    rm(`${collectionRoot}/*/*`);
  };
}

function generateMarkdown(collectionName, id, item, _, cache) {
  if (!item) {
    return;
  }

  const itemDirPath = `${getCollectionRoot(collectionName)}/${id}`;
  const data = Object.keys(item)
    .filter(key => ['title', 'date', 'tags', 'categories'].includes(key) && item[key])
    .reduce((acc, key) => ({ ...acc, [key]: item[key] }), {});

  data.permalink = `/${collectionName}/${id}/`;

  ensureDirExists(itemDirPath);
  saveData(`${itemDirPath}/index.md`, `---\n${dump(data)}---\n\n${cache.content}\n`);
}

function readMetadata(dirPath, raw) {
  let filePath = `${dirPath}/basic.yml`;
  let exists = existsSync(filePath);

  if (!exists) {
    filePath = `${dirPath}/metadata.yml`;
    exists = existsSync(filePath);
  }

  if (raw) {
    return exists && readData(filePath, raw) || '';
  }

  if (!exists) {
    return {};
  }

  const metadata = readData(filePath);
  const bannerMetadata = metadata.banner;

  let image = metadata.image;

  if (bannerMetadata) {
    const banner = typeof bannerMetadata === 'string' ? bannerMetadata : bannerMetadata.url;

    if (banner) {
      metadata.banner = banner;

      if (!image) {
        image = banner;
      }
    }
  }

  if (image) {
    metadata.image = image;
  }

  return metadata;
}

function getAndCopyItemImages(sourceDir, distDir) {
  if (existsSync(distDir)) {
    rm(distDir);
  }

  const images = getImageFileNames(sourceDir);

  if (images.length === 0) {
    return null;
  }

  ensureDirExists(distDir);

  const imageData = {};
  const sequenced = [];

  getImageFileNames(sourceDir).forEach(fileName => {
    if (isNaN(parseFloat(fileName))) {
      METADATA_IMAGE_KEYS.forEach(baseName => {
        if (fileName.indexOf(baseName) === 0) {
          imageData[baseName] = fileName;
        }
      });
    } else {
      sequenced.push(fileName);
    }

    cp(`${sourceDir}/${fileName}`, `${distDir}/${fileName}`);
  });

  if (sequenced.length > 0) {
    imageData.sequenced = sequenced.length > 1 ? sortByName(sequenced) : sequenced;
  }

  return imageData;
}

function createGeneratorLegacy(collectionName, dataSourceRoot, localDataDir, localImageRoot, opts) {
  let localImageDir;
  let resolvedOptions;

  if (typeof localImageRoot === 'object') {
    localImageDir = '';
    resolvedOptions = localImageRoot;
  } else {
    localImageDir = localImageRoot ? localImageRoot : '';
    resolvedOptions = opts || {};
  }

  const {
    paramPath = 'slug',
    fileExt = 'yml',
    metadataRequired = true,
    removeWhenLocalImageDirExists = true,
    getItemSlug = slug => slug, getItemImageDir, getItemImageSourceDir, getImagePath,
    readItem = readMetadata, transformItem = (_, item) => item, transformData = items => items,
    beforeRead = noop, readEach = noop, afterRead = noop, afterSave = noop,
  } = resolvedOptions;
  return function() {
    if (localImageDir) {
      localImageDir = `${typeof localImageRoot === 'function' ? localImageRoot() : localImageRoot}/${collectionName}`
    }

    const dataSourceDir = typeof dataSourceRoot === 'function' ? dataSourceRoot() : `${dataSourceRoot}/${collectionName}`;
    const localDataFile = `${typeof localDataDir === 'function' ? localDataDir() : localDataDir}/${collectionName}.${fileExt}`;
    const imagePathPrefix = localImageDir.replace(`${getLocalDocRoot()}/`, '');

    ensureFileExists(localDataFile, true);

    if (localImageDir) {
      ensureDirExists(localImageDir, removeWhenLocalImageDirExists);
    }

    const items = {};
    const cache = {};

    beforeRead(cache);

    const paramArr = paramPath.split('/');

    readDirDeeply(dataSourceDir, paramArr, {}, (slug, params) => {
      const pathFromParams = paramArr.map(paramKey => params[paramKey]).join('/');
      const itemDir = `${dataSourceDir}/${pathFromParams}`;
      const item = readItem(itemDir);
      const hasMetadata = Object.keys(item).length > 0;
      const paths = { itemDir, imageDir: localImageDir };

      if (localImageDir) {
        const imageDir = getItemImageDir ? getItemImageDir(item, params, paths) : `${localImageDir}/${pathFromParams}`;
        const imageSourceDir = getItemImageSourceDir ? getItemImageSourceDir(item, params, paths) : itemDir
        const imageData = getAndCopyItemImages(imageSourceDir, imageDir);

        if (imageData) {
          if (imageData.sequenced) {
            item.images = imageData.sequenced;
          }

          METADATA_IMAGE_KEYS.forEach(k => {
            const imageFileName = imageData[k];

            if (imageFileName) {
              const imagePath = getImagePath ? getImagePath(slug, imageFileName, item) : `/knosys/${imagePathPrefix}/${slug}/${imageFileName}`;

              if (k === 'banner') {
                const itemBanner = item.banner;

                if (typeof itemBanner === 'object') {
                  const { url, ...others } = itemBanner;

                  item[k] = { url: url || imagePath, ...others };
                } else {
                  item[k] = { url: itemBanner || imagePath };
                }
              } else {
                item[k] = imagePath;
              }
            }
          });

          if (!item.banner && item.thumbnail) {
            item.banner = { url: item.thumbnail };
          }
        }
      }

      if (metadataRequired && !hasMetadata) {
        return;
      }

      const resolvedItem = transformItem(slug, item, params, cache, paths);

      if (resolvedItem) {
        items[getItemSlug(slug, resolvedItem)] = resolvedItem;
      }

      readEach(slug, resolvedItem, params, cache, paths);
    });

    afterRead(cache);
    saveData(localDataFile, transformData(items, cache));
    afterSave(cache);
  }
}

function createGenerator(sourceRootPath, collectionName, opts) {
  return createGeneratorLegacy(collectionName, sourceRootPath, getLocalDataRoot, getLocalDocRoot, {
    paramPath: 'id',
    metadataRequired: false,
    beforeRead: createBeforeReadHook(collectionName),
    readEach: generateMarkdown.bind(null, collectionName),
    ...opts,
  });
}

module.exports = { getItemSourceDir, cacheClassifyItems, getCollectionRoot, createGenerator };
