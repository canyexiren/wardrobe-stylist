/**
 * storage.js — 数据存储层
 * 封装 IndexedDB 操作（通过 Dexie.js），提供衣物和设置的增删改查
 */

'use strict';

/* ---- 初始化数据库 ---- */
const db = new Dexie('WardrobeDB');

db.version(1).stores({
  clothing: '++id, category, warmth, style, season, createdAt',
  settings: '&key',
});

/* ========================================
   衣物 CRUD
   ======================================== */

/** 添加一件衣物，返回新建的id */
async function addClothing(item) {
  const now = Date.now();
  const newItem = {
    ...item,
    createdAt: now,
    // 确保以下字段有默认值
    name: item.name || '',
    category: item.category || 'top-outer',
    color: item.color || '',
    warmth: item.warmth || 'medium',
    style: item.style || [],
    season: item.season || [],
    image: item.image || '',
  };
  const id = await db.clothing.add(newItem);
  console.log(`[storage] 已添加衣物: id=${id}, name="${newItem.name}"`);
  return id;
}

/** 获取所有衣物（按创建时间倒序） */
async function getAllClothing() {
  const items = await db.clothing.orderBy('createdAt').reverse().toArray();
  return items;
}

/** 根据ID获取单件衣物 */
async function getClothingById(id) {
  return await db.clothing.get(id);
}

/** 根据分类获取衣物 */
async function getClothingByCategory(category) {
  if (category === 'all') return getAllClothing();
  return await db.clothing
    .where('category')
    .equals(category)
    .reverse()
    .sortBy('createdAt');
}

/** 更新衣物 */
async function updateClothing(id, updates) {
  const count = await db.clothing.update(id, updates);
  console.log(`[storage] 已更新衣物: id=${id}, 变更字段数=${count}`);
  return count;
}

/** 删除衣物 */
async function deleteClothing(id) {
  await db.clothing.delete(id);
  console.log(`[storage] 已删除衣物: id=${id}`);
}

/** 获取衣物总数 */
async function getClothingCount() {
  return await db.clothing.count();
}

/* ========================================
   设置读写
   ======================================== */

/** 获取一个设置值 */
async function getSetting(key, defaultValue = null) {
  const entry = await db.settings.get(key);
  return entry ? entry.value : defaultValue;
}

/** 保存一个设置值 */
async function setSetting(key, value) {
  await db.settings.put({ key, value });
  console.log(`[storage] 已保存设置: ${key}=${JSON.stringify(value)}`);
}

/* ========================================
   数据导入导出
   ======================================== */

/** 导出所有数据为JSON对象 */
async function exportData() {
  const clothing = await getAllClothing();
  const allSettings = await db.settings.toArray();
  const settings = {};
  allSettings.forEach(s => { settings[s.key] = s.value; });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    clothing,
    settings,
  };
}

/** 从JSON对象导入数据（清空现有数据） */
async function importData(jsonData) {
  if (!jsonData || !jsonData.clothing) {
    throw new Error('无效的备份文件');
  }

  // 清空现有数据
  await db.clothing.clear();
  await db.settings.clear();

  // 导入衣物
  if (jsonData.clothing.length > 0) {
    await db.clothing.bulkAdd(jsonData.clothing);
  }

  // 导入设置
  if (jsonData.settings) {
    const entries = Object.entries(jsonData.settings).map(([key, value]) => ({ key, value }));
    if (entries.length > 0) {
      await db.settings.bulkPut(entries);
    }
  }

  console.log(`[storage] 数据导入完成: ${jsonData.clothing.length}件衣物`);
}

/* ---- 暴露到全局 ---- */
// 供浏览器控制台和后续模块使用
window.db = db;
window.addClothing = addClothing;
window.getAllClothing = getAllClothing;
window.getClothingById = getClothingById;
window.getClothingByCategory = getClothingByCategory;
window.updateClothing = updateClothing;
window.deleteClothing = deleteClothing;
window.getClothingCount = getClothingCount;
window.getSetting = getSetting;
window.setSetting = setSetting;
window.exportData = exportData;
window.importData = importData;
