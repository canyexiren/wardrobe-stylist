# 技术规格说明书

> 版本: v1.0 | 日期: 2026-06-07

## 1. 技术架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────┐
│              浏览器 (Browser)                 │
│                                               │
│  ┌──────────────────────────────────────┐    │
│  │         前端应用 (SPA-like)           │    │
│  │                                       │    │
│  │  index.html (入口)                    │    │
│  │    ├── css/style.css (样式)           │    │
│  │    ├── js/app.js (主控制器)            │    │
│  │    ├── js/storage.js (数据层)          │    │
│  │    ├── js/wardrobe.js (衣橱管理)       │    │
│  │    ├── js/outfit.js (穿搭算法)         │    │
│  │    └── js/weather.js (天气服务)        │    │
│  │                                       │    │
│  │  数据存储: IndexedDB (via Dexie.js)    │    │
│  └──────────────────────────────────────┘    │
│                                               │
│  外部依赖:                                     │
│  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Dexie.js     │  │  Open-Meteo API      │  │
│  │  (IndexedDB   │  │  (免费天气数据)       │  │
│  │  封装库)      │  │  api.open-meteo.com  │  │
│  └──────────────┘  └──────────────────────┘  │
│                                               │
│  浏览器API:                                    │
│  ┌──────────────────────────────────────┐    │
│  │  Geolocation API (定位)               │    │
│  │  FileReader API (图片读取)             │    │
│  │  IndexedDB API (数据持久化)            │    │
│  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 1.2 技术选型理由

| 选择 | 理由 |
|------|------|
| 纯前端（无服务器） | 用户无需安装或配置任何东西，数据完全本地，隐私安全 |
| 无框架（Vanilla JS） | 零依赖，文件少，加载快，对新手友好 |
| IndexedDB | 存储容量大（通常 >50MB），可存图片base64 |
| Dexie.js | 简化IndexedDB操作，API简洁 |
| Open-Meteo | 完全免费、无需注册、无需API Key |

---

## 2. 数据模型

### 2.1 clothing 表（衣物）

```javascript
{
  id: Number,          // 自增主键
  name: String,        // 衣物名称（必填）
  category: String,    // 分类: "top-outer" | "bottom" | "dress" | "shoes-acc"
  color: String,       // 颜色描述（如 "黑色"、"蓝色"）
  warmth: String,      // 保暖度: "thin" | "medium" | "thick" | "extra-thick"
  style: Array,        // 风格标签: ["commute", "casual", "elegant"]
  season: Array,       // 适合季节: ["spring", "summer", "autumn", "winter"]
  image: String,       // 照片base64编码（可为空字符串）
  createdAt: Number    // 创建时间戳
}
```

### 2.2 settings 表（设置）

```javascript
{
  key: String,    // 设置键名（如 "defaultStyle", "temperatureUnit"）
  value: Any      // 设置值
}
```

**预置设置项**:
| key | 默认值 | 说明 |
|-----|--------|------|
| `defaultStyle` | `"casual"` | 默认风格偏好 |
| `temperatureUnit` | `"celsius"` | 温度单位 |

---

## 3. API 接口说明

### 3.1 Open-Meteo 天气 API

**端点**: `https://api.open-meteo.com/v1/forecast`

**请求参数**:
```
?latitude={lat}
&longitude={lon}
&current_weather=true
&hourly=temperature_2m,weathercode
&timezone=auto
```

**响应示例**:
```json
{
  "current_weather": {
    "temperature": 22.5,
    "weathercode": 1,
    "windspeed": 12.3
  }
}
```

**天气代码映射** (WMO Weather Codes):

| 代码 | 中文描述 | 图标 |
|------|---------|------|
| 0 | 晴朗 | ☀️ |
| 1-3 | 多云 | ⛅ |
| 45, 48 | 雾 | 🌫️ |
| 51-55 | 毛毛雨 | 🌧️ |
| 61-65 | 雨 | 🌧️ |
| 71-77 | 雪 | ❄️ |
| 80-82 | 阵雨 | 🌦️ |
| 95-99 | 雷暴 | ⛈️ |

---

## 4. 模块职责

### 4.1 `storage.js` — 数据存储层
- 初始化 Dexie 数据库
- 衣物增删改查（addClothing, getClothingById, getAllClothing, updateClothing, deleteClothing）
- 设置读写（getSetting, setSetting）
- 数据导出/导入（exportData, importData）

### 4.2 `weather.js` — 天气服务
- 获取用户地理位置（getUserLocation）
- 调用 Open-Meteo API 获取天气（fetchWeather）
- 天气代码转中文描述（weatherCodeToText）
- 天气代码转 emoji 图标（weatherCodeToIcon）

### 4.3 `wardrobe.js` — 衣橱管理UI
- 渲染衣物列表/网格（renderWardrobe）
- 分类筛选逻辑（filterByCategory）
- 添加/编辑表单弹窗（showAddForm, showEditForm）
- 删除确认（confirmDelete）

### 4.4 `outfit.js` — 穿搭生成
- 温度 → 保暖度映射（tempToWarmth）
- 天气 → 外套需求判断（weatherNeedsOuterwear）
- 穿搭匹配主函数（generateOutfit）
- 单品类换一换（swapItem）

### 4.5 `app.js` — 应用主控
- Tab切换管理（switchTab）
- 页面初始化（initApp）
- 全局状态管理

---

## 5. 关键算法

### 5.1 穿搭匹配算法

```
function generateOutfit(temperature, weatherCode, stylePreference) {
  // Step 1: 确定需要的保暖度
  let targetWarmth = [];
  if (T > 30) targetWarmth = ['thin'];
  else if (T > 20) targetWarmth = ['thin', 'medium'];
  else if (T > 10) targetWarmth = ['medium'];
  else if (T > 0) targetWarmth = ['thick'];
  else targetWarmth = ['extra-thick'];

  // Step 2: 确定天气是否需要外套
  let needOuterwear = [45, 51,53,55, 61,63,65, 71,73,75,77, 80,81,82, 95,96,99].includes(weatherCode);

  // Step 3: 从衣橱筛选
  let candidates = allClothing.filter(item => {
    // 保暖度匹配
    if (!targetWarmth.includes(item.warmth)) return false;
    // 风格匹配
    if (!item.style.includes(stylePreference)) return false;
    return true;
  });

  // Step 4: 按分类挑选
  let outfit = {
    topOuter: pickRandom(candidates, 'top-outer'),
    bottom: pickRandom(candidates, 'bottom'),
    shoes: pickRandom(candidates, 'shoes-acc'),
  };

  // 连衣裙可替代上衣+下装
  let dress = pickRandom(candidates, 'dress');
  if (dress && Math.random() > 0.5) {
    delete outfit.topOuter;
    delete outfit.bottom;
    outfit.dress = dress;
  }

  // Step 5: 颜色协调加分（优先同色系）
  outfit = applyColorHarmony(outfit, candidates);

  return outfit;
}
```

### 5.2 颜色协调规则（简化版）

```
同色系 > 中性色搭配 > 撞色搭配

色系分组:
- 暖色: 红, 橙, 黄, 粉
- 冷色: 蓝, 绿, 紫
- 中性: 黑, 白, 灰, 米, 棕

规则:
- 同色系内搭配 +2分
- 中性色与任意搭配 +1分
- 冷暖混搭 0分
```

---

## 6. 编码规范

### 6.1 命名规范
- 文件名: 小写 + 短横线 (`style.css`, `wardrobe.js`)
- 函数名: 驼峰命名 (`getAllClothing`, `renderWardrobe`)
- CSS类名: 短横线命名 (`.tab-nav`, `.clothing-card`)
- 常量: 全大写 (`MAX_IMAGE_SIZE`, `WEATHER_CODES`)

### 6.2 注释规范
- 每个JS文件头部注明文件职责
- 关键函数有简短功能说明
- 复杂逻辑有行内注释

### 6.3 图片处理
- 上传图片压缩至最大宽度 600px
- 转换为 JPEG 格式，质量 0.7
- base64 编码后存入 IndexedDB
