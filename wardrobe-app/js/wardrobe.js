/**
 * wardrobe.js — 衣橱管理UI
 * 负责：衣物渲染、添加/编辑表单、照片处理、保存删除
 */

'use strict';

/* ---- DOM 引用 ---- */
const wardrobeGrid = document.getElementById('wardrobeGrid');
const wardrobeEmpty = document.getElementById('wardrobeEmpty');
const filterBar = document.getElementById('filterBar');
const fabAdd = document.getElementById('fabAdd');
const modalOverlay = document.getElementById('modalOverlay');
const modalCard = document.getElementById('modalCard');
const modalTitle = document.getElementById('modalTitle');
const modalClose = document.getElementById('modalClose');
const btnSave = document.getElementById('btnSave');
const btnDelete = document.getElementById('btnDelete');

// 表单字段
const inputEditId = document.getElementById('inputEditId');
const inputName = document.getElementById('inputName');
const inputCategory = document.getElementById('inputCategory');
const inputColor = document.getElementById('inputColor');
const inputPhoto = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const photoUpload = document.getElementById('photoUpload');
const photoCanvas = document.getElementById('photoCanvas');
const tagStyle = document.getElementById('tagStyle');
const tagSeason = document.getElementById('tagSeason');

// 当前照片base64数据
let currentImageData = '';
// 当前编辑的衣物id（null表示新增模式）
let editingId = null;
// 当前选中的分类筛选（'all' | 'top-outer' | 'bottom' | 'dress' | 'shoes-acc'）
let currentFilter = 'all';

/* ========================================
   表单显示/隐藏
   ======================================== */

/** 打开弹窗 — 新增模式 */
function showAddForm() {
  editingId = null;
  inputEditId.value = '';
  modalTitle.textContent = '添加衣物';
  btnDelete.style.display = 'none';
  resetForm();
  modalOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

/** 打开弹窗 — 编辑模式 */
async function showEditForm(id) {
  const item = await getClothingById(id);
  if (!item) return;

  editingId = id;
  inputEditId.value = id;
  modalTitle.textContent = '编辑衣物';
  btnDelete.style.display = 'block';

  // 填充表单
  inputName.value = item.name || '';
  inputCategory.value = item.category || '';
  inputColor.value = item.color || '';
  currentImageData = item.image || '';
  renderPhotoPreview();

  // 保暖度单选
  const warmthRadio = document.querySelector(`input[name="warmth"][value="${item.warmth || 'medium'}"]`);
  if (warmthRadio) warmthRadio.checked = true;

  // 风格多选
  tagStyle.querySelectorAll('.tag-chip').forEach(chip => {
    chip.classList.toggle('selected', (item.style || []).includes(chip.dataset.value));
  });

  // 季节多选
  tagSeason.querySelectorAll('.tag-chip').forEach(chip => {
    chip.classList.toggle('selected', (item.season || []).includes(chip.dataset.value));
  });

  modalOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

/** 关闭弹窗 */
function hideForm() {
  modalOverlay.classList.remove('show');
  document.body.style.overflow = '';
  resetForm();
}

/** 重置表单 */
function resetForm() {
  inputName.value = '';
  inputCategory.value = '';
  inputColor.value = '';
  currentImageData = '';
  inputPhoto.value = '';
  renderPhotoPreview();

  // 重置保暖度
  const warmthRadios = document.querySelectorAll('input[name="warmth"]');
  warmthRadios.forEach(r => r.checked = false);

  // 重置风格/季节标签
  tagStyle.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('selected'));
  tagSeason.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('selected'));
}

/* ========================================
   照片处理
   ======================================== */

/** 触发文件选择 */
function triggerPhotoUpload() {
  inputPhoto.click();
}

/** 处理照片选择 */
function handlePhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 仅接受图片
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    // 压缩图片
    compressImage(e.target.result, function (compressed) {
      currentImageData = compressed;
      renderPhotoPreview();
    });
  };
  reader.readAsDataURL(file);
}

/** Canvas 压缩图片（最大宽度600px，JPEG质量0.7） */
function compressImage(dataUrl, callback) {
  const img = new Image();
  img.onload = function () {
    let { width, height } = img;
    const maxWidth = 600;

    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    photoCanvas.width = width;
    photoCanvas.height = height;
    const ctx = photoCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const compressed = photoCanvas.toDataURL('image/jpeg', 0.7);
    callback(compressed);
  };
  img.src = dataUrl;
}

/** 刷新照片预览区 */
function renderPhotoPreview() {
  if (currentImageData) {
    photoPreview.innerHTML = `<img src="${currentImageData}" alt="预览">`;
    photoUpload.classList.add('has-image');
  } else {
    photoPreview.innerHTML = `
      <span class="photo-placeholder-icon">📷</span>
      <span class="photo-placeholder-text">点击上传照片</span>`;
    photoUpload.classList.remove('has-image');
  }
}

/* ========================================
   多选标签交互
   ======================================== */

/** 初始化标签组点击事件 */
function initTagGroups() {
  // 风格标签
  tagStyle.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
    });
  });

  // 季节标签
  tagSeason.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
    });
  });
}

/** 获取标签组中选中的值 */
function getSelectedTags(groupEl) {
  const chips = groupEl.querySelectorAll('.tag-chip.selected');
  return Array.from(chips).map(c => c.dataset.value);
}

/* ========================================
   表单提交
   ======================================== */

/** 保存衣物 */
async function handleSave() {
  // 表单验证
  const name = inputName.value.trim();
  if (!name) { alert('请输入衣物名称'); inputName.focus(); return; }

  const category = inputCategory.value;
  if (!category) { alert('请选择分类'); inputCategory.focus(); return; }

  const warmthRadio = document.querySelector('input[name="warmth"]:checked');
  if (!warmthRadio) { alert('请选择保暖度'); return; }

  const selectedStyles = getSelectedTags(tagStyle);
  if (selectedStyles.length === 0) { alert('请至少选择一个风格标签'); return; }

  // 组装数据
  const item = {
    name,
    category,
    color: inputColor.value.trim(),
    warmth: warmthRadio.value,
    style: selectedStyles,
    season: getSelectedTags(tagSeason),
    image: currentImageData,
  };

  btnSave.textContent = '保存中...';
  btnSave.disabled = true;
  try {
    if (editingId) {
      await updateClothing(editingId, item);
    } else {
      await addClothing(item);
    }
    hideForm();
    await refreshWardrobe();
    window.showToast && window.showToast(editingId ? '衣物已更新' : '衣物已添加', 'success');
  } catch (err) {
    console.error('保存失败:', err);
    window.showToast && window.showToast('保存失败，请重试', 'error');
  } finally {
    btnSave.textContent = '保存';
    btnSave.disabled = false;
  }
}

/** 删除衣物 */
async function handleDelete() {
  if (!editingId) return;
  if (!confirm('确定要删除这件衣物吗？此操作不可恢复。')) return;

  try {
    await deleteClothing(editingId);
    hideForm();
    await refreshWardrobe();
    window.showToast && window.showToast('衣物已删除', 'info');
  } catch (err) {
    console.error('删除失败:', err);
    window.showToast && window.showToast('删除失败，请重试', 'error');
  }
}

/* ========================================
   衣橱渲染
   ======================================== */

/** 渲染衣物网格 */
async function refreshWardrobe() {
  // 根据当前筛选获取衣物
  const items = currentFilter === 'all'
    ? await getAllClothing()
    : await getClothingByCategory(currentFilter);

  if (items.length === 0) {
    wardrobeGrid.innerHTML = '';
    wardrobeEmpty.classList.remove('hidden');
    // 根据是否在筛选状态显示不同提示
    const emptyHint = document.querySelector('.placeholder-hint');
    if (emptyHint) {
      emptyHint.textContent = currentFilter === 'all'
        ? '点击右下角 + 添加你的第一件衣物'
        : '该分类下暂无衣物，试试其他分类或添加新衣物';
    }
  } else {
    wardrobeEmpty.classList.add('hidden');
    wardrobeGrid.innerHTML = items.map(item => {
      const imageHtml = item.image
        ? `<img class="clothing-card-img" src="${item.image}" alt="${escapeHtml(item.name)}">`
        : `<div class="clothing-card-img-placeholder">👗</div>`;

      const styleNames = { commute: '通勤', casual: '休闲', elegant: '精致' };
      const styleTags = (item.style || []).map(s => styleNames[s] || s);

      return `
        <div class="clothing-card" data-id="${item.id}">
          ${imageHtml}
          <div class="clothing-card-body">
            <div class="clothing-card-name">${escapeHtml(item.name)}</div>
            <div class="clothing-card-tags">
              ${styleTags.map(t => `<span class="clothing-card-tag">${t}</span>`).join('')}
            </div>
          </div>
        </div>`;
    }).join('');

    // 卡片点击 → 编辑
    wardrobeGrid.querySelectorAll('.clothing-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.id);
        if (id) showEditForm(id);
      });
    });
  }
}

/** HTML转义（防XSS） */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ========================================
   初始化
   ======================================== */

function initWardrobe() {
  // 标签组交互
  initTagGroups();

  // FAB点击 → 新增
  fabAdd.addEventListener('click', showAddForm);

  // 分类筛选点击
  filterBar.addEventListener('click', function (e) {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    const filterValue = chip.dataset.filter;
    if (filterValue === currentFilter) return;

    // 更新高亮
    filterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    // 切换筛选并刷新
    currentFilter = filterValue;
    refreshWardrobe();
  });

  // 关闭弹窗
  modalClose.addEventListener('click', hideForm);
  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) hideForm();
  });

  // 照片上传
  photoUpload.addEventListener('click', triggerPhotoUpload);
  inputPhoto.addEventListener('change', handlePhotoSelect);

  // 保存/删除
  btnSave.addEventListener('click', handleSave);
  btnDelete.addEventListener('click', handleDelete);

  // 初始渲染
  refreshWardrobe();
}

// 页面加载后自动初始化
document.addEventListener('DOMContentLoaded', initWardrobe);
