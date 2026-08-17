/* ============================================
   TT工作台 - Album Module (回忆相册)
   ============================================ */

window.TT = window.TT || {};

TT.Album = (function() {
  let fabElement = null;
  let multiImages = [];
  let currentFilter = '';
  let selectedCategory = '';

  function render(container) {
    const categories = TT.Store.getAlbumCategories();
    container.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <div class="page-title-group">
            <h1>回忆相册</h1>
            <p class="page-subtitle">记录与朋友的美好时光</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="album-add-btn">
              ${TT.Utils.icon('plus', 16)} 新建回忆
            </button>
          </div>
        </div>
        <div class="album-filter-bar" id="album-filter-bar"></div>
        <div id="album-grid" class="album-grid"></div>
      </div>
    `;

    document.getElementById('album-add-btn').onclick = () => openEditor();

    // FAB
    if (fabElement) fabElement.remove();
    fabElement = document.createElement('button');
    fabElement.className = 'fab';
    fabElement.innerHTML = TT.Utils.icons.plus;
    fabElement.title = '新建回忆';
    fabElement.onclick = () => openEditor();
    document.body.appendChild(fabElement);

    renderFilterBar();
    renderGrid();
  }

  function renderFilterBar() {
    const bar = document.getElementById('album-filter-bar');
    if (!bar) return;

    const categories = TT.Store.getAlbumCategories();
    const items = TT.Store.getCollection('album');
    if (!categories.includes(currentFilter)) currentFilter = categories[0] || '';

    // Count per category
    const counts = {};
    categories.forEach(cat => { counts[cat] = items.filter(i => i.category === cat).length; });

    bar.innerHTML = `
      ${categories.map(cat => `
        <span class="category-filter-unit">
          <button class="album-filter-chip ${currentFilter === cat ? 'active' : ''}" data-filter="${TT.Utils.escapeHtml(cat)}">
            ${TT.Utils.escapeHtml(cat)} <span class="album-filter-count">${counts[cat] || 0}</span>
          </button>
          <button class="category-delete-btn" data-delete-category="${TT.Utils.escapeHtml(cat)}" title="删除分类">${TT.Utils.icons.close}</button>
        </span>
      `).join('')}
      <button class="album-filter-chip album-filter-add" id="album-add-category">
        ${TT.Utils.icons.plus}
      </button>
    `;

    bar.querySelectorAll('.album-filter-chip[data-filter]').forEach(chip => {
      chip.onclick = () => {
        currentFilter = chip.dataset.filter;
        renderFilterBar();
        renderGrid();
      };
    });

    bar.querySelectorAll('[data-delete-category]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        promptDeleteCategory(btn.dataset.deleteCategory);
      };
    });

    document.getElementById('album-add-category').onclick = () => promptAddCategory();
  }

  async function promptAddCategory() {
    const name = await TT.Utils.showInput({
      title: '新增分类',
      text: '输入新的分类名称，如「6人朋友」「同事」等',
      placeholder: '分类名称'
    });
    if (!name) return;
    TT.Store.addAlbumCategory(name);
    TT.Utils.toast('分类已添加');
    renderFilterBar();
    renderGrid();
  }

  async function promptDeleteCategory(name) {
    const used = TT.Store.getCollection('album').filter(i => i.category === name).length;
    const ok = await TT.Utils.confirm({
      title: '删除相册分类',
      text: used ? `该分类有 ${used} 条回忆，删除后将自动转移到其他分类。` : `确定删除「${name}」分类？`
    });
    if (!ok) return;
    currentFilter = TT.Store.removeAlbumCategory(name);
    TT.Utils.toast('分类已删除');
    renderFilterBar();
    renderGrid();
  }

  function renderGrid() {
    const grid = document.getElementById('album-grid');
    if (!grid) return;

    const items = TT.Store.getCollection('album');
    const filtered = items.filter(i => i.category === currentFilter);

    const sorted = [...filtered].sort((a, b) => {
      const da = new Date(a.date || a.createdAt || 0);
      const db = new Date(b.date || b.createdAt || 0);
      return db - da;
    });

    if (sorted.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:80px 20px;">
          <div class="empty-state-icon">${TT.Utils.icons.image}</div>
          <div class="empty-state-text" style="font-size:14px;margin-bottom:4px;">该分类下暂无回忆</div>
          <div class="empty-state-text">点击右上角「新建回忆」记录与朋友的美好时光</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = sorted.map((item, i) => {
      const cover = item.images && item.images.length > 0 ? item.images[0] : null;
      const photoCount = item.images ? item.images.length : 0;
      return `
        <div class="glass-card album-card stagger-item" style="animation-delay:${i * 0.06}s" data-id="${item.id}">
          <div class="album-card-cover">
            ${cover ? `<img src="${cover}" alt="">` : `<div class="album-card-placeholder">${TT.Utils.icons.image}</div>`}
            ${photoCount > 1 ? `<div class="album-card-count">${TT.Utils.icons.image} ${photoCount}</div>` : ''}
            ${item.category ? `<div class="album-card-badge">${TT.Utils.escapeHtml(item.category)}</div>` : ''}
          </div>
          <div class="album-card-body">
            <div class="album-card-title">${TT.Utils.escapeHtml(item.title || '未命名回忆')}</div>
            <div class="album-card-meta">
              ${item.date ? `<span>${TT.Utils.formatDate(item.date, 'short')}</span>` : ''}
              ${item.location ? `<span>${TT.Utils.escapeHtml(item.location)}</span>` : ''}
            </div>
            ${item.description ? `<div class="album-card-desc">${TT.Utils.escapeHtml(item.description)}</div>` : ''}
          </div>
          <div class="album-card-actions">
            <button class="task-action-btn" onclick="event.stopPropagation();TT.Album.editItem('${item.id}')">${TT.Utils.icons.edit}</button>
            <button class="task-action-btn delete" onclick="event.stopPropagation();TT.Album.deleteItem('${item.id}')">${TT.Utils.icons.trash}</button>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.album-card').forEach(card => {
      card.onclick = () => openGallery(card.dataset.id);
    });
  }

  // ===== Gallery / Lightbox =====
  function openGallery(id) {
    const items = TT.Store.getCollection('album');
    const item = items.find(i => i.id === id);
    if (!item || !item.images || item.images.length === 0) return;

    let currentIndex = 0;
    const images = item.images;

    const overlay = document.createElement('div');
    overlay.className = 'album-gallery-overlay';
    overlay.innerHTML = `
      <div class="gallery-topbar">
        <div class="gallery-title">${TT.Utils.escapeHtml(item.title || '回忆')}</div>
        <button class="gallery-close">${TT.Utils.icons.close}</button>
      </div>
      <div class="gallery-stage">
        <button class="gallery-arrow gallery-arrow-left">${TT.Utils.icons.chevronLeft}</button>
        <img class="gallery-img" src="${images[0]}" alt="">
        <button class="gallery-arrow gallery-arrow-right">${TT.Utils.icons.chevronRight}</button>
      </div>
      <div class="gallery-bottom">
        <div class="gallery-counter"><span class="gallery-current">1</span> / ${images.length}</div>
        ${item.category ? `<div class="gallery-category-tag">${TT.Utils.escapeHtml(item.category)}</div>` : ''}
        ${item.description ? `<div class="gallery-desc">${TT.Utils.escapeHtml(item.description)}</div>` : ''}
        ${item.date || item.location ? `<div class="gallery-info">${item.date ? TT.Utils.formatDate(item.date) : ''} ${item.location ? '· ' + TT.Utils.escapeHtml(item.location) : ''}</div>` : ''}
      </div>
      <div class="gallery-dots">
        ${images.map((_, i) => `<div class="gallery-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`).join('')}
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function showImage(idx) {
      currentIndex = idx;
      const img = overlay.querySelector('.gallery-img');
      img.style.opacity = '0';
      setTimeout(() => {
        img.src = images[currentIndex];
        img.style.opacity = '1';
      }, 150);
      overlay.querySelector('.gallery-current').textContent = currentIndex + 1;
      overlay.querySelectorAll('.gallery-dot').forEach((d, i) => {
        d.classList.toggle('active', i === currentIndex);
      });
      // Show/hide arrows
      overlay.querySelector('.gallery-arrow-left').style.visibility = images.length > 1 ? 'visible' : 'hidden';
      overlay.querySelector('.gallery-arrow-right').style.visibility = images.length > 1 ? 'visible' : 'hidden';
    }

    overlay.querySelector('.gallery-close').onclick = closeGallery;
    overlay.querySelector('.gallery-arrow-left').onclick = (e) => {
      e.stopPropagation();
      showImage((currentIndex - 1 + images.length) % images.length);
    };
    overlay.querySelector('.gallery-arrow-right').onclick = (e) => {
      e.stopPropagation();
      showImage((currentIndex + 1) % images.length);
    };

    overlay.querySelectorAll('.gallery-dot').forEach(dot => {
      dot.onclick = (e) => {
        e.stopPropagation();
        showImage(parseInt(dot.dataset.index));
      };
    });

    overlay.onclick = (e) => {
      if (e.target === overlay || e.target.classList.contains('gallery-stage')) closeGallery();
    };

    // Keyboard
    const escHandler = (e) => {
      if (e.key === 'Escape') closeGallery();
      if (e.key === 'ArrowLeft') showImage((currentIndex - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') showImage((currentIndex + 1) % images.length);
    };
    document.addEventListener('keydown', escHandler);

    // Touch swipe
    let touchStartX = 0;
    overlay.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    });
    overlay.addEventListener('touchend', (e) => {
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) showImage((currentIndex - 1 + images.length) % images.length);
        else showImage((currentIndex + 1) % images.length);
      }
    });

    function closeGallery() {
      overlay.style.animation = 'galleryFadeOut 0.25s ease forwards';
      document.removeEventListener('keydown', escHandler);
      document.body.style.overflow = '';
      setTimeout(() => overlay.remove(), 250);
    }

    showImage(0);
  }

  // ===== Editor =====
  function openEditor(id) {
    const items = TT.Store.getCollection('album');
    const item = id ? items.find(i => i.id === id) : null;

    multiImages = item ? [...(item.images || [])] : [];
    selectedCategory = item ? (item.category || '') : '';

    const categories = TT.Store.getAlbumCategories();

    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">照片（可上传多张）</label>
        <div class="multi-image-upload" id="album-image-area">
          <div class="multi-image-grid" id="album-image-grid">
            ${multiImages.map((src, idx) => `
              <div class="multi-image-thumb" data-index="${idx}">
                <img src="${src}" alt="">
                <button class="multi-image-remove" onclick="event.stopPropagation();TT.Album.removeImage(${idx})">${TT.Utils.icons.close}</button>
              </div>
            `).join('')}
            <div class="multi-image-add" id="album-image-add">
              ${TT.Utils.icons.image}
              <div>添加照片</div>
            </div>
          </div>
          <input type="file" id="album-image-input" accept="image/*" multiple style="display:none;">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">分类</label>
        <div class="album-category-chips" id="album-category-chips">
          ${categories.map(cat => `
            <button class="album-category-chip ${selectedCategory === cat ? 'active' : ''}" data-cat="${TT.Utils.escapeHtml(cat)}">
              ${TT.Utils.escapeHtml(cat)}
            </button>
          `).join('')}
          <button class="album-category-chip album-category-add" id="album-category-add">
            ${TT.Utils.icons.plus} 新增
          </button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">回忆标题</label>
        <input type="text" class="form-input" id="album-title" value="${item ? TT.Utils.escapeHtml(item.title || '') : ''}" placeholder="如：三亚之旅" maxlength="50">
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:0 0 130px;">
          <label class="form-label">日期</label>
          <input type="date" class="form-input" id="album-date" value="${item ? (item.date || TT.Utils.todayStr()) : TT.Utils.todayStr()}">
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">地点</label>
          <input type="text" class="form-input" id="album-location" value="${item ? TT.Utils.escapeHtml(item.location || '') : ''}" placeholder="如：三亚">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">描述</label>
        <textarea class="form-textarea" id="album-description" placeholder="记录这段回忆的故事..." maxlength="500">${item ? TT.Utils.escapeHtml(item.description || '') : ''}</textarea>
      </div>
    `;

    const m = TT.Utils.modal({
      title: id ? '编辑回忆' : '新建回忆',
      size: 'lg',
      body: body,
      confirmText: id ? '保存' : '创建',
      onConfirm: () => {
        const title = document.getElementById('album-title').value.trim();
        if (!title) { TT.Utils.toast('请输入回忆标题', 'error'); return false; }

        const data = {
          title,
          category: selectedCategory,
          date: document.getElementById('album-date').value,
          location: document.getElementById('album-location').value.trim(),
          description: document.getElementById('album-description').value.trim(),
          images: [...multiImages]
        };

        if (id) {
          TT.Store.updateItem('album', id, data);
          TT.Utils.toast('已保存');
        } else {
          TT.Store.addItem('album', data);
          TT.Utils.toast('回忆已创建');
        }
        renderFilterBar();
        renderGrid();
      }
    });

    // Category chip selection
    const chipsContainer = m.el.querySelector('#album-category-chips');
    const bindCategoryChip = (chip) => {
      chip.onclick = (e) => {
        e.stopPropagation();
        selectedCategory = chip.dataset.cat;
        chipsContainer.querySelectorAll('.album-category-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      };
    };
    chipsContainer.querySelectorAll('.album-category-chip[data-cat]').forEach(bindCategoryChip);

    // Add custom category from editor
    m.el.querySelector('#album-category-add').onclick = async (e) => {
      e.stopPropagation();
      const name = await TT.Utils.showInput({
        title: '新增分类',
        text: '输入新的分类名称',
        placeholder: '如：6人朋友、同事'
      });
      if (!name) return;
      if (TT.Store.getAlbumCategories().includes(name)) {
        TT.Utils.toast('分类已存在', 'error');
        return;
      }
      TT.Store.addAlbumCategory(name);
      selectedCategory = name;
      chipsContainer.querySelectorAll('.album-category-chip').forEach(c => c.classList.remove('active'));
      const newChip = document.createElement('button');
      newChip.className = 'album-category-chip active';
      newChip.dataset.cat = name;
      newChip.textContent = name;
      bindCategoryChip(newChip);
      chipsContainer.insertBefore(newChip, m.el.querySelector('#album-category-add'));
      TT.Utils.toast('分类已添加并选中');
    };

    setupMultiImageUpload(m.el);

    setTimeout(() => document.getElementById('album-title').focus(), 100);
  }

  // ===== Multi-Image Upload =====
  function setupMultiImageUpload(modalEl) {
    const addBtn = modalEl.querySelector('#album-image-add');
    const input = modalEl.querySelector('#album-image-input');

    addBtn.onclick = (e) => {
      e.stopPropagation();
      input.click();
    };

    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      let processed = 0;
      files.forEach(file => {
        if (file.size > 10 * 1024 * 1024) {
          TT.Utils.toast('图片不能超过10MB', 'error');
          processed++;
          checkAllDone();
          return;
        }
        TT.Utils.fileToBase64(file, (base64) => {
          if (base64) {
            multiImages.push(base64);
          }
          processed++;
          checkAllDone();
        });
      });

      function checkAllDone() {
        if (processed === files.length) {
          renderMultiImageGrid(modalEl);
          input.value = '';
        }
      }
    };
  }

  function renderMultiImageGrid(modalEl) {
    const grid = modalEl.querySelector('#album-image-grid');
    if (!grid) return;
    grid.innerHTML = `
      ${multiImages.map((src, idx) => `
        <div class="multi-image-thumb" data-index="${idx}">
          <img src="${src}" alt="">
          <button class="multi-image-remove" onclick="event.stopPropagation();TT.Album.removeImage(${idx})">${TT.Utils.icons.close}</button>
        </div>
      `).join('')}
      <div class="multi-image-add" id="album-image-add">
        ${TT.Utils.icons.image}
        <div>添加照片</div>
      </div>
    `;
    const addBtn = grid.querySelector('#album-image-add');
    const input = modalEl.querySelector('#album-image-input');
    addBtn.onclick = (e) => {
      e.stopPropagation();
      input.click();
    };
  }

  function removeImage(idx) {
    multiImages.splice(idx, 1);
    const modal = document.querySelector('.modal-body');
    if (modal) renderMultiImageGrid(modal.parentElement);
  }

  // ===== Delete =====
  async function deleteItem(id) {
    const ok = await TT.Utils.confirm({ title: '删除回忆', text: '这段回忆及其所有照片将被永久删除。' });
    if (ok) {
      TT.Store.removeItem('album', id);
      TT.Utils.toast('已删除');
      renderFilterBar();
      renderGrid();
    }
  }

  function cleanup() {
    if (fabElement) {
      fabElement.remove();
      fabElement = null;
    }
  }

  return {
    render,
    editItem: (id) => openEditor(id),
    deleteItem,
    removeImage,
    cleanup
  };
})();
