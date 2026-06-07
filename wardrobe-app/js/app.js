/**
 * app.js — 应用主控制器
 * 负责：Tab切换、页面初始化、个人中心设置
 */

'use strict';

/* ---- Toast 通知 ---- */

/**
 * 显示轻提醒（替代 alert 用于非阻塞反馈）
 * @param {string} message - 消息文本
 * @param {'success'|'error'|'warning'|'info'} type - 类型
 */
function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);
  // 动画结束后自动移除
  setTimeout(function () {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3000);
}
// 暴露到全局，供其他模块使用
window.showToast = showToast;

/* ---- 页面标题映射 ---- */
const PAGE_TITLES = {
  outfit: '穿搭灵感',
  wardrobe: '我的衣橱',
  profile: '个人中心',
};

/* ---- 当前选中的Tab ---- */
let currentTab = 'outfit';

/* ---- DOM元素引用 ---- */
const tabButtons = document.querySelectorAll('.tab-btn');
const pages = document.querySelectorAll('.page');
const headerTitle = document.getElementById('headerTitle');

/* ---- Tab切换 ---- */
function switchTab(tabName) {
  if (tabName === currentTab) return;

  currentTab = tabName;

  // 更新底部导航高亮
  tabButtons.forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active', isActive);
  });

  // 切换页面
  pages.forEach(page => {
    const isActive = page.id === `page-${tabName}`;
    page.classList.toggle('active', isActive);
  });

  // 更新顶部标题
  headerTitle.textContent = PAGE_TITLES[tabName] || '穿搭灵感';

  // 滚动到顶部
  document.getElementById('appMain').scrollTop = 0;
}

/* ---- 事件绑定 ---- */
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    if (tabName) switchTab(tabName);
  });
});

/* ========================================
   个人中心 — 偏好设置
   ======================================== */

/** 初始化个人中心风格选择器 */
function initProfileStyle() {
  const selector = document.getElementById('profileStyleSelector');
  if (!selector) return;

  selector.querySelectorAll('.style-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      selector.querySelectorAll('.style-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      const style = chip.dataset.style;
      try {
        await setSetting('defaultStyle', style);
        // 同步穿搭灵感页的风格选择器
        syncOutfitStyleSelector(style);
      } catch (e) {}
    });
  });

  // 加载当前设置
  loadProfileStyle(selector);
}

/** 加载已保存的风格到个人中心选择器 */
async function loadProfileStyle(selector) {
  try {
    const saved = await getSetting('defaultStyle', 'casual');
    selector.querySelectorAll('.style-chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.style === saved);
    });
  } catch (e) {}
}

/** 同步穿搭灵感页的风格选择器 */
function syncOutfitStyleSelector(style) {
  const outfitSelector = document.getElementById('styleSelector');
  if (!outfitSelector) return;
  outfitSelector.querySelectorAll('.style-chip').forEach(chip => {
    chip.classList.toggle('selected', chip.dataset.style === style);
  });
  // 更新 outfit.js 的 currentStyle 变量（如果已加载）
  if (typeof window.updateOutfitStyle === 'function') {
    window.updateOutfitStyle(style);
  }
}

/* ========================================
   个人中心 — 温度单位
   ======================================== */

/** 初始化温度单位切换 */
function initUnitToggle() {
  const toggle = document.getElementById('unitToggle');
  if (!toggle) return;

  toggle.querySelectorAll('.unit-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      toggle.querySelectorAll('.unit-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const unit = btn.dataset.unit;
      try {
        await setSetting('temperatureUnit', unit);
        // 更新天气卡片显示
        updateWeatherUnit(unit);
      } catch (e) {}
    });
  });

  // 加载当前设置
  loadUnitSetting(toggle);
}

/** 加载已保存的温度单位 */
async function loadUnitSetting(toggle) {
  try {
    const saved = await getSetting('temperatureUnit', 'celsius');
    toggle.querySelectorAll('.unit-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.unit === saved);
    });
  } catch (e) {}
}

/** 根据温度单位更新天气卡片显示 */
function updateWeatherUnit(unit) {
  const tempEl = document.getElementById('weatherTemp');
  if (!tempEl || !window.currentWeather) return;

  const celsius = window.currentWeather.temperature;
  const displayTemp = unit === 'fahrenheit'
    ? Math.round(celsius * 9 / 5 + 32)
    : Math.round(celsius);
  const unitLabel = unit === 'fahrenheit' ? '°F' : '°C';
  tempEl.textContent = `${displayTemp}${unitLabel}`;
}

/* ========================================
   个人中心 — 数据导入导出
   ======================================== */

/** 导出数据 */
async function handleExport() {
  const btnExport = document.getElementById('btnExport');
  try {
    btnExport.textContent = '⏳ 导出中...';
    btnExport.disabled = true;

    const data = await exportData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // 触发下载
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    a.download = `衣橱备份_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('数据导出成功', 'success');
    console.log('[app] 数据导出成功');
  } catch (err) {
    console.error('导出失败:', err);
    showToast('导出失败，请重试', 'error');
  } finally {
    btnExport.textContent = '📤 导出';
    btnExport.disabled = false;
  }
}

/** 导入数据 */
async function handleImport(file) {
  if (!file) return;

  // 确认覆盖
  if (!confirm('导入将覆盖当前所有数据（包括衣物和设置），确定继续吗？')) {
    return;
  }

  const btnImport = document.getElementById('btnImport');
  try {
    btnImport.textContent = '⏳ 导入中...';
    btnImport.disabled = true;

    const text = await readFileAsText(file);
    const data = JSON.parse(text);

    // 验证数据格式
    if (!data.clothing || !Array.isArray(data.clothing)) {
      throw new Error('无效的备份文件格式');
    }

    await importData(data);

    // 刷新各模块
    if (typeof refreshWardrobe === 'function') {
      await refreshWardrobe();
    }
    if (typeof initWeather === 'function') {
      await initWeather();
    }

    // 刷新个人中心显示
    initProfileStyle();
    initUnitToggle();

    showToast('导入成功！共恢复 ' + data.clothing.length + ' 件衣物', 'success');
    console.log('[app] 数据导入成功');
  } catch (err) {
    console.error('导入失败:', err);
    showToast('导入失败：' + err.message, 'error');
  } finally {
    btnImport.textContent = '📥 导入';
    btnImport.disabled = false;
  }
}

/** 读取文件为文本 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'UTF-8');
  });
}

/* ========================================
   个人中心 — 初始化
   ======================================== */

function initProfile() {
  // 绑定导出按钮
  const btnExport = document.getElementById('btnExport');
  if (btnExport) {
    btnExport.addEventListener('click', handleExport);
  }

  // 绑定导入按钮
  const btnImport = document.getElementById('btnImport');
  const fileInput = document.getElementById('importFileInput');
  if (btnImport && fileInput) {
    btnImport.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleImport(file);
        fileInput.value = ''; // 清空以支持重复选择同一文件
      }
    });
  }

  // 初始化设置项
  initProfileStyle();
  initUnitToggle();
}

/* ========================================
   全局初始化
   ======================================== */

function initApp() {
  // 默认显示穿搭灵感页
  switchTab('outfit');
  console.log('衣橱穿搭助手 已就绪 ✨');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
  initApp();
  initProfile();
});
