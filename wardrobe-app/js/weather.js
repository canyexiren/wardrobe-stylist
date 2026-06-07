/**
 * weather.js — 天气服务
 * 负责：获取用户定位、调用 Open-Meteo API、天气展示
 */

'use strict';

/* ---- DOM 引用（在 index.html 中定义）---- */
const weatherSection = document.getElementById('weatherSection');
const weatherLoading = document.getElementById('weatherLoading');
const weatherError = document.getElementById('weatherError');
const weatherCard = document.getElementById('weatherCard');
const weatherIcon = document.getElementById('weatherIcon');
const weatherTemp = document.getElementById('weatherTemp');
const weatherDesc = document.getElementById('weatherDesc');
const weatherLocation = document.getElementById('weatherLocation');
const weatherRefresh = document.getElementById('weatherRefresh');
const weatherInput = document.getElementById('weatherCityInput');
const weatherInputBtn = document.getElementById('weatherCityBtn');

/* ---- 天气代码映射 ---- */

/** WMO Weather Code → 中文描述 */
function weatherCodeToText(code) {
  if (code === 0) return '晴朗';
  if (code >= 1 && code <= 3) return '多云';
  if (code === 45 || code === 48) return '雾';
  if (code >= 51 && code <= 55) return '毛毛雨';
  if (code >= 61 && code <= 65) return '雨';
  if (code >= 71 && code <= 77) return '雪';
  if (code >= 80 && code <= 82) return '阵雨';
  if (code >= 95 && code <= 99) return '雷暴';
  return '未知';
}

/** WMO Weather Code → Emoji 图标 */
function weatherCodeToIcon(code) {
  if (code === 0) return '☀️';
  if (code >= 1 && code <= 3) return '⛅';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 55) return '🌧️';
  if (code >= 61 && code <= 65) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95 && code <= 99) return '⛈️';
  return '🌡️';
}

/* ---- UI 状态切换 ---- */

/** 显示加载状态 */
function showLoading() {
  weatherLoading.style.display = 'flex';
  weatherError.style.display = 'none';
  weatherCard.style.display = 'none';
}

/** 显示天气卡片 */
function showWeatherCard() {
  weatherLoading.style.display = 'none';
  weatherError.style.display = 'none';
  weatherCard.style.display = 'block';
}

/** 显示错误/手动输入 */
function showError(message) {
  weatherLoading.style.display = 'none';
  weatherCard.style.display = 'none';
  weatherError.style.display = 'block';
  const msgEl = weatherError.querySelector('.weather-error-msg');
  if (msgEl) msgEl.textContent = message;
}

/* ---- 天气获取 ---- */

/** 获取用户地理位置（浏览器 Geolocation API） */
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持定位功能'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function (position) {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      function (err) {
        // 根据错误类型给出中文提示
        const messages = {
          1: '位置权限被拒绝，请允许浏览器获取位置，或手动输入城市名称',
          2: '无法获取位置信息，请检查设备定位是否开启',
          3: '获取位置超时，请手动输入城市名称',
        };
        reject(new Error(messages[err.code] || '定位失败，请手动输入城市名称'));
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
    );
  });
}

/** 通过城市名获取坐标（Open-Meteo Geocoding API — 免费无需Key） */
async function geocodeCity(cityName) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=zh`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('城市查询失败');

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error('未找到该城市，请换个城市名试试');
  }

  const result = data.results[0];
  // 组装显示名称
  const parts = [result.name];
  if (result.admin1) parts.push(result.admin1);
  if (result.country) parts.push(result.country);
  const displayName = parts.join('，');

  return {
    lat: result.latitude,
    lon: result.longitude,
    name: displayName,
  };
}

/** 调用 Open-Meteo API 获取当前天气 */
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('天气数据获取失败');

  const data = await response.json();
  const cw = data.current_weather;

  return {
    temperature: cw.temperature,
    weatherCode: cw.weathercode,
    windSpeed: cw.windspeed,
  };
}

/** 将天气数据渲染到卡片中 */
async function renderWeatherCard(weatherData, locationName) {
  weatherIcon.textContent = weatherCodeToIcon(weatherData.weatherCode);
  weatherDesc.textContent = weatherCodeToText(weatherData.weatherCode);
  weatherLocation.textContent = locationName;

  // 根据用户设置的温度单位显示
  try {
    const unit = await getSetting('temperatureUnit', 'celsius');
    const temp = unit === 'fahrenheit'
      ? Math.round(weatherData.temperature * 9 / 5 + 32)
      : Math.round(weatherData.temperature);
    weatherTemp.textContent = `${temp}°${unit === 'fahrenheit' ? 'F' : 'C'}`;
  } catch (e) {
    // settings表可能尚未初始化
    weatherTemp.textContent = `${Math.round(weatherData.temperature)}°C`;
  }

  showWeatherCard();
}

/* ---- 主流程 ---- */

/** 初始化天气：自动定位 → 获取天气 → 渲染 */
async function initWeather() {
  showLoading();

  try {
    // Step 1: 获取位置
    const pos = await getUserLocation();

    // Step 2: 获取天气
    const weatherData = await fetchWeather(pos.lat, pos.lon);

    // Step 3: 渲染
    const locationName = `${pos.lat.toFixed(2)}°, ${pos.lon.toFixed(2)}°`;
    renderWeatherCard(weatherData, locationName);

    // 保存天气数据到全局，供穿搭模块使用
    window.currentWeather = weatherData;

  } catch (err) {
    console.warn('[weather] 自动定位失败:', err.message);
    showError(err.message);
  }
}

/** 通过手动输入城市名获取天气 */
async function fetchWeatherByCity(cityName) {
  showLoading();

  try {
    // Step 1: 地理编码
    const geo = await geocodeCity(cityName.trim());

    // Step 2: 获取天气
    const weatherData = await fetchWeather(geo.lat, geo.lon);

    // Step 3: 渲染
    renderWeatherCard(weatherData, geo.name);

    // 保存到全局
    window.currentWeather = weatherData;

  } catch (err) {
    console.warn('[weather] 城市查询失败:', err.message);
    showError(err.message);
  }
}

/* ---- 事件绑定 ---- */
function bindWeatherEvents() {
  // 刷新按钮
  weatherRefresh.addEventListener('click', initWeather);

  // 城市搜索按钮
  weatherInputBtn.addEventListener('click', function () {
    const city = weatherInput.value.trim();
    if (!city) {
      alert('请输入城市名称');
      return;
    }
    fetchWeatherByCity(city);
  });

  // 回车搜索
  weatherInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const city = weatherInput.value.trim();
      if (city) fetchWeatherByCity(city);
    }
  });
}

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', function () {
  bindWeatherEvents();
  initWeather();
});
