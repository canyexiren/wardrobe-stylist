/**
 * outfit.js — 穿搭生成
 * 负责：风格选择、温度匹配、穿搭组合生成、换一换
 */

'use strict';

/* ---- DOM 引用 ---- */
const styleSelector = document.getElementById('styleSelector');
const btnGenerate = document.getElementById('btnGenerate');
const outfitResult = document.getElementById('outfitResult');
const outfitEmptyHint = document.getElementById('outfitEmptyHint');

// 当前选中的风格
let currentStyle = 'casual';
// 当前生成的穿搭结果
let currentOutfit = null;
// 本轮可用的候选项（用于换一换）
let candidatePool = {};

/* ---- 分类中文名映射 ---- */
const CATEGORY_NAMES = {
  'top-outer': '上衣 / 外套',
  'bottom': '下装',
  'dress': '连衣裙 / 连体衣',
  'shoes-acc': '鞋子 / 配饰',
};

const CATEGORY_ORDER = ['top-outer', 'bottom', 'shoes-acc'];

/* ========================================
   风格选择器
   ======================================== */

/** 初始化风格选择器（点击切换单选） */
function initStyleSelector() {
  styleSelector.querySelectorAll('.style-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      // 更新选中状态
      styleSelector.querySelectorAll('.style-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      currentStyle = chip.dataset.style;
      // 保存为默认风格
      try { await setSetting('defaultStyle', currentStyle); } catch (e) {}
    });
  });

  // 从设置中读取默认风格
  loadDefaultStyle();
}

/** 加载用户默认风格 */
async function loadDefaultStyle() {
  try {
    const saved = await getSetting('defaultStyle', 'casual');
    currentStyle = saved;
    styleSelector.querySelectorAll('.style-chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.style === saved);
    });
  } catch (e) {
    // settings表可能尚未初始化，使用默认值
  }
}

/** 供个人中心调用的风格同步函数 */
function updateOutfitStyle(style) {
  currentStyle = style;
}
// 暴露到全局
window.updateOutfitStyle = updateOutfitStyle;

/* ========================================
   穿搭匹配算法
   ======================================== */

/** 温度 → 需要的保暖度数组 */
function tempToWarmth(temp) {
  if (temp > 30) return ['thin'];
  if (temp > 20) return ['thin', 'medium'];
  if (temp > 10) return ['medium'];
  if (temp > 0)  return ['thick'];
  return ['extra-thick'];
}

/** 天气代码 → 是否需要外套（雨雪雾等恶劣天气） */
function weatherNeedsOuterwear(code) {
  // 雾、雨、雪、阵雨、雷暴
  const badWeather = [45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75, 77, 80, 81, 82, 95, 96, 99];
  return badWeather.includes(code);
}

/** 检查两个颜色是否协调 */
function colorsHarmonize(color1, color2) {
  if (!color1 || !color2) return false;

  // 色系分组
  const warmColors = ['红', '橙', '黄', '粉'];
  const coolColors = ['蓝', '绿', '紫', '青'];
  const neutralColors = ['黑', '白', '灰', '米', '棕', '咖', '银'];

  const getGroup = (c) => {
    if (warmColors.some(w => c.includes(w))) return 'warm';
    if (coolColors.some(w => c.includes(w))) return 'cool';
    if (neutralColors.some(w => c.includes(w))) return 'neutral';
    return 'other';
  };

  const g1 = getGroup(color1);
  const g2 = getGroup(color2);

  // 同色系: +2分
  if (g1 === g2 && g1 !== 'other') return 2;
  // 中性色搭配任意: +1分
  if (g1 === 'neutral' || g2 === 'neutral') return 1;
  // 冷暖混搭: 0分
  return 0;
}

/** 从候选中随机选一件 */
function pickRandom(items) {
  if (!items || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

/** 核心匹配函数：根据天气+温度+风格生成穿搭 */
async function generateOutfit() {
  // 检查天气数据
  if (!window.currentWeather) {
    alert('请先获取天气数据');
    return null;
  }

  const temp = window.currentWeather.temperature;
  const weatherCode = window.currentWeather.weatherCode;

  // Step 1: 确定保暖度要求
  const targetWarmths = tempToWarmth(temp);

  // Step 2: 是否需要外套优先
  const needOuter = weatherNeedsOuterwear(weatherCode);

  // Step 3: 获取所有衣物
  const allClothing = await getAllClothing();
  if (allClothing.length === 0) return { empty: true };

  // Step 4: 筛选候选项
  const candidates = allClothing.filter(item => {
    // 保暖度匹配
    if (!targetWarmths.includes(item.warmth)) return false;
    // 风格匹配
    if (!item.style || !item.style.includes(currentStyle)) return false;
    return true;
  });

  if (candidates.length === 0) return { noMatch: true, targetWarmths, currentStyle };

  // Step 5: 按分类分组
  const pool = { 'top-outer': [], 'bottom': [], 'dress': [], 'shoes-acc': [] };
  candidates.forEach(item => {
    if (pool[item.category]) pool[item.category].push(item);
  });

  // 保存候选池（用于换一换）
  candidatePool = { ...pool };

  // Step 6: 从每个分类挑选
  const outfit = {};

  // 连衣裙可替代上衣+下装
  const hasDress = pool.dress.length > 0;
  const useDress = hasDress && Math.random() > 0.5;

  if (useDress) {
    outfit.dress = pickRandom(pool.dress);
    // 连衣裙替代了上衣+下装
    outfit.topOuter = null;
    outfit.bottom = null;
  } else {
    // 必须选上衣+外套（如果pool有的话）
    if (pool['top-outer'].length > 0) {
      outfit.topOuter = pickRandom(pool['top-outer']);
    }
    // 必须选下装
    if (pool.bottom.length > 0) {
      outfit.bottom = pickRandom(pool.bottom);
    }
    outfit.dress = null;
  }

  // 鞋子+配饰
  if (pool['shoes-acc'].length > 0) {
    outfit.shoes = pickRandom(pool['shoes-acc']);
  } else {
    outfit.shoes = null;
  }

  // 如果top-outer为空且没裙装，放宽保暖度再试
  if (!outfit.topOuter && !outfit.dress) {
    const relaxed = allClothing.filter(item => {
      if (!item.style || !item.style.includes(currentStyle)) return false;
      return item.category === 'top-outer';
    });
    if (relaxed.length > 0) {
      outfit.topOuter = pickRandom(relaxed);
      // 将放宽选的也加入候选池
      candidatePool['top-outer'] = [...candidatePool['top-outer'], ...relaxed];
    }
  }

  // 如果下装为空且没裙装，放宽保暖度
  if (!outfit.bottom && !outfit.dress) {
    const relaxed = allClothing.filter(item => {
      if (!item.style || !item.style.includes(currentStyle)) return false;
      return item.category === 'bottom';
    });
    if (relaxed.length > 0) {
      outfit.bottom = pickRandom(relaxed);
      candidatePool.bottom = [...candidatePool.bottom, ...relaxed];
    }
  }

  // Step 7: 颜色协调加分（用于记录，实际已在随机选择中）
  outfit.colorScore = 0;
  const items = [outfit.topOuter, outfit.bottom, outfit.dress, outfit.shoes].filter(Boolean);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      outfit.colorScore += colorsHarmonize(items[i].color, items[j].color);
    }
  }

  outfit.needOuter = needOuter;
  outfit.temp = temp;
  outfit.weatherCode = weatherCode;
  outfit.useDress = useDress;

  return outfit;
}

/* ========================================
   穿搭结果渲染
   ======================================== */

/** 渲染穿搭结果 */
function renderOutfit(outfit) {
  if (!outfit) return;

  outfitEmptyHint.style.display = 'none';

  // 空衣橱
  if (outfit.empty) {
    outfitResult.innerHTML = `
      <div class="outfit-message">
        <span class="outfit-message-icon">👗</span>
        <p>衣橱还是空的，先去「我的衣橱」添加一些衣物吧</p>
      </div>`;
    return;
  }

  // 无匹配
  if (outfit.noMatch) {
    const warmthNames = { thin: '薄款', medium: '适中', thick: '厚款', 'extra-thick': '加厚' };
    const styleNames = { commute: '通勤', casual: '休闲', elegant: '精致' };
    const warmthDesc = outfit.targetWarmths.map(w => warmthNames[w] || w).join('/');
    outfitResult.innerHTML = `
      <div class="outfit-message">
        <span class="outfit-message-icon">🔍</span>
        <p>当前温度需要 <strong>${warmthDesc}</strong> 的衣物，风格为 <strong>${styleNames[outfit.currentStyle]}</strong></p>
        <p class="outfit-message-hint">衣橱中没有找到同时匹配保暖度和风格的衣物<br>试试添加更多衣物，或切换风格</p>
      </div>`;
    return;
  }

  // 正常渲染
  let html = '';

  // 温度/风格提示条
  const weatherIcon = outfit.weatherCode != null ? weatherCodeToIcon(outfit.weatherCode) : '🌡️';
  const weatherDesc = outfit.weatherCode != null ? weatherCodeToText(outfit.weatherCode) : '';
  const styleNames = { commute: '通勤', casual: '休闲', elegant: '精致' };

  html += `
    <div class="outfit-info-bar">
      <span>${weatherIcon} ${outfit.temp}°C ${weatherDesc}</span>
      <span>👔 ${styleNames[currentStyle]}风格</span>
    </div>`;

  // 连衣裙模式
  if (outfit.dress) {
    html += renderOutfitItem(outfit.dress, 'dress');
  }

  // 上衣+外套
  if (outfit.topOuter) {
    html += renderOutfitItem(outfit.topOuter, 'top-outer');
  }

  // 下装
  if (outfit.bottom) {
    html += renderOutfitItem(outfit.bottom, 'bottom');
  }

  // 鞋子+配饰
  if (outfit.shoes) {
    html += renderOutfitItem(outfit.shoes, 'shoes-acc');
  }

  outfitResult.innerHTML = html;

  // 绑定换一换按钮
  outfitResult.querySelectorAll('.btn-swap').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;
      swapItem(category);
    });
  });
}

/** 渲染单个穿搭条目 */
function renderOutfitItem(item, category) {
  const imageHtml = item.image
    ? `<img class="outfit-item-img" src="${item.image}" alt="${escapeHtml(item.name)}">`
    : `<div class="outfit-item-img-placeholder">👗</div>`;

  return `
    <div class="outfit-item" data-category="${category}">
      <span class="outfit-item-label">${CATEGORY_NAMES[category]}</span>
      <div class="outfit-item-card">
        ${imageHtml}
        <div class="outfit-item-info">
          <span class="outfit-item-name">${escapeHtml(item.name)}</span>
          <span class="outfit-item-color">${escapeHtml(item.color || '—')}</span>
        </div>
        <button class="btn-swap" data-category="${category}" title="换一件">🔄</button>
      </div>
    </div>`;
}

/* ========================================
   换一换
   ======================================== */

/** 从候选池中换掉指定分类的单品 */
function swapItem(category) {
  if (!candidatePool[category] || candidatePool[category].length <= 1) {
    // 只有一件或没有候选项
    const btn = outfitResult.querySelector(`.btn-swap[data-category="${category}"]`);
    if (btn) {
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = '🔄'; }, 600);
    }
    return;
  }

  // 排除当前已选的，从剩余中随机选
  const currentName = currentOutfit[category]?.name;
  const others = candidatePool[category].filter(item => item.name !== currentName);
  if (others.length === 0) return;

  const newItem = pickRandom(others);

  // 更新currentOutfit
  if (category === 'dress') {
    currentOutfit.dress = newItem;
    currentOutfit.topOuter = null;
    currentOutfit.bottom = null;
  } else if (category === 'top-outer') {
    currentOutfit.topOuter = newItem;
  } else if (category === 'bottom') {
    currentOutfit.bottom = newItem;
  } else if (category === 'shoes-acc') {
    currentOutfit.shoes = newItem;
  }

  // 重新渲染
  renderOutfit(currentOutfit);
}

/* ========================================
   HTML转义（与 wardrobe.js 保持一致）
   ======================================== */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ========================================
   事件绑定与初始化
   ======================================== */

function initOutfit() {
  // 风格选择器
  initStyleSelector();

  // 生成穿搭按钮
  btnGenerate.addEventListener('click', async () => {
    // 检查衣橱
    const count = await getClothingCount();
    if (count === 0) {
      outfitResult.innerHTML = `
        <div class="outfit-message">
          <span class="outfit-message-icon">👗</span>
          <p>衣橱还是空的</p>
          <p class="outfit-message-hint">先去「我的衣橱」添加一些衣物吧</p>
        </div>`;
      outfitEmptyHint.style.display = 'none';
      return;
    }

    // 检查天气
    if (!window.currentWeather) {
      window.showToast && window.showToast('天气数据还在加载中，请稍候再试', 'warning');
      return;
    }

    // 生成穿搭
    btnGenerate.textContent = '⏳ 生成中...';
    btnGenerate.disabled = true;

    try {
      currentOutfit = await generateOutfit();
      renderOutfit(currentOutfit);
    } catch (err) {
      console.error('穿搭生成失败:', err);
      window.showToast && window.showToast('生成失败，请重试', 'error');
    } finally {
      btnGenerate.textContent = '✨ 生成穿搭';
      btnGenerate.disabled = false;
    }
  });
}

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', initOutfit);
