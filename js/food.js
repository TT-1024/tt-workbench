/* ============================================
   TT工作台 - Food Journal Module
   奶茶 / Fine Dining
   ============================================ */

window.TT = window.TT || {};

TT.Food = (function() {
  let currentTab = 'milktea';
  let calendarDate = new Date();

  function render(container) {
    container.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <div class="page-title-group">
            <h1>美食记录</h1>
            <p class="page-subtitle">奶茶打卡日历 & Fine Dining 记录</p>
          </div>
          <div class="page-actions" id="food-actions">
            <button class="btn btn-primary" id="food-add-btn" style="${currentTab === 'milktea' ? 'display:none;' : ''}">
              ${TT.Utils.icon('plus', 16)} 新增记录
            </button>
          </div>
        </div>

        <div class="food-tabs">
          <button class="food-tab ${currentTab === 'milktea' ? 'active' : ''}" data-tab="milktea">
            ${TT.Utils.icon('coffee', 16)} 奶茶
          </button>
          <button class="food-tab ${currentTab === 'finedining' ? 'active' : ''}" data-tab="finedining">
            ${TT.Utils.icon('utensils', 16)} Fine Dining
          </button>
        </div>

        <div id="food-content"></div>
      </div>
    `;

    container.querySelectorAll('.food-tab').forEach(btn => {
      btn.onclick = () => {
        currentTab = btn.dataset.tab;
        container.querySelectorAll('.food-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
        // Show/hide add button
        const addBtn = document.getElementById('food-add-btn');
        if (addBtn) addBtn.style.display = currentTab === 'milktea' ? 'none' : '';
        renderContent();
      };
    });

    const addBtn = document.getElementById('food-add-btn');
    if (addBtn) addBtn.onclick = () => openEditor();

    renderContent();
  }

  function renderContent() {
    const content = document.getElementById('food-content');

    if (currentTab === 'milktea') {
      renderCalendar(content);
      return;
    }

    // Fine Dining
    const path = 'food.finedining';
    const items = TT.Store.getCollection(path);

    const sorted = [...items].sort((a, b) => {
      const da = new Date(a.date || a.createdAt || 0);
      const db = new Date(b.date || b.createdAt || 0);
      return db - da;
    });

    if (sorted.length === 0) {
      content.innerHTML = `
        <div class="empty-state" style="padding:80px 20px;">
          <div class="empty-state-icon">${TT.Utils.icons.utensils}</div>
          <div class="empty-state-text" style="font-size:14px;margin-bottom:4px;">暂无 Fine Dining 记录</div>
          <div class="empty-state-text">点击右上角「新增记录」开始记录</div>
        </div>
      `;
      return;
    }

    content.innerHTML = `<div class="food-masonry">${sorted.map((item, i) => renderFineDiningCard(item, i)).join('')}</div>`;

    // Card click
    content.querySelectorAll('.food-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('.food-card-action-btn')) return;
        TT.Food.editItem(card.dataset.id);
      };
    });
  }

  // ===== Milk Tea Calendar =====
  function renderCalendar(content) {
    const dates = TT.Store.getCollection('food.milkteaDates');
    const markedSet = new Set(dates);

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Count this month's marked dates
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthMarked = dates.filter(d => d.startsWith(monthPrefix)).length;

    // Total count
    const totalMarked = dates.length;

    // Today
    const todayStr = TT.Utils.todayStr();

    let html = `
      <div class="milktea-calendar glass-card slide-up">
        <div class="calendar-header">
          <button class="calendar-nav-btn" id="cal-prev">${TT.Utils.icons.chevronLeft}</button>
          <div class="calendar-title">${year}年${month + 1}月</div>
          <button class="calendar-nav-btn" id="cal-next">${TT.Utils.icons.chevronRight}</button>
        </div>
        <div class="calendar-stats">本月喝了 <strong>${monthMarked}</strong> 杯奶茶 🧋　累计 <strong>${totalMarked}</strong> 杯</div>
        <div class="calendar-weekdays">
          <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
        </div>
        <div class="calendar-grid">
    `;

    // Previous month's trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="calendar-day other-month">${daysInPrevMonth - i}</div>`;
    }

    // Current month's days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isMarked = markedSet.has(dateStr);
      const isToday = dateStr === todayStr;
      const classes = ['calendar-day'];
      if (isMarked) classes.push('marked');
      if (isToday) classes.push('today');
      html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${d}</div>`;
    }

    // Next month's leading days
    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      html += `<div class="calendar-day other-month">${d}</div>`;
    }

    html += `</div>
        <div class="calendar-hint">点击日期标记/取消喝奶茶</div>
      </div>
    `;

    content.innerHTML = html;

    // Bind navigation
    document.getElementById('cal-prev').onclick = () => {
      calendarDate = new Date(year, month - 1, 1);
      renderCalendar(content);
    };
    document.getElementById('cal-next').onclick = () => {
      calendarDate = new Date(year, month + 1, 1);
      renderCalendar(content);
    };

    // Bind date click
    content.querySelectorAll('.calendar-day[data-date]').forEach(day => {
      day.onclick = () => toggleMilkTeaDate(day.dataset.date);
    });
  }

  function toggleMilkTeaDate(dateStr) {
    const dates = TT.Store.getCollection('food.milkteaDates');
    const idx = dates.indexOf(dateStr);
    if (idx !== -1) {
      dates.splice(idx, 1);
    } else {
      dates.push(dateStr);
    }
    TT.Store.setCollection('food.milkteaDates', dates);
    const content = document.getElementById('food-content');
    renderCalendar(content);
  }

  function renderMilkTeaCard(item, i) {
    const rating = item.rating || 0;
    const stars = Array.from({length: 5}, (_, idx) =>
      idx < rating ? TT.Utils.icons.star : TT.Utils.icons.starOutline
    ).join('');

    return `
      <div class="glass-card food-card stagger-item" style="animation-delay:${i * 0.05}s" data-id="${item.id}">
        <div class="food-card-image">
          ${item.image ? `<img src="${item.image}" alt="">` : `
            <div class="food-card-image-placeholder">${TT.Utils.icons.coffee}</div>
          `}
          <div class="food-card-overlay">
            <div class="food-card-rating">${stars}</div>
          </div>
          <div class="food-card-actions">
            <button class="food-card-action-btn" onclick="event.stopPropagation();TT.Food.editItem('${item.id}')">${TT.Utils.icons.edit}</button>
            <button class="food-card-action-btn" onclick="event.stopPropagation();TT.Food.deleteItem('${item.id}')">${TT.Utils.icons.trash}</button>
          </div>
        </div>
        <div class="food-card-body">
          <div class="food-card-title">${TT.Utils.escapeHtml(item.drink || '未知饮品')}</div>
          <div class="food-card-subtitle">${TT.Utils.escapeHtml(item.shop || '')}</div>
          ${item.review ? `<div class="food-card-desc">${TT.Utils.escapeHtml(item.review)}</div>` : ''}
          <div class="food-card-meta">
            <span>${item.date ? TT.Utils.formatDate(item.date, 'short') : ''}</span>
            <span>★ ${rating}/5</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderFineDiningCard(item, i) {
    const rating = item.rating || 0;
    const stars = Array.from({length: 5}, (_, idx) =>
      idx < rating ? TT.Utils.icons.star : TT.Utils.icons.starOutline
    ).join('');

    // Support both new `images` array and old single `image` field
    const images = item.images || (item.image ? [item.image] : []);
    const mainImage = images.length > 0 ? images[0] : null;

    return `
      <div class="glass-card food-card fine-dining-card stagger-item" style="animation-delay:${i * 0.05}s" data-id="${item.id}">
        <div class="food-card-image">
          ${mainImage ? `<img src="${mainImage}" alt="${TT.Utils.escapeHtml(item.restaurant || 'Fine Dining')}" loading="lazy">` : `
            <div class="food-card-image-placeholder">${TT.Utils.icons.utensils}</div>
          `}
          ${images.length > 1 ? `<div class="food-card-photo-count">${images.length}</div>` : ''}
          <div class="food-card-overlay">
            <div class="food-card-rating">${stars}</div>
          </div>
          <div class="food-card-actions">
            <button class="food-card-action-btn" onclick="event.stopPropagation();TT.Food.editItem('${item.id}')">${TT.Utils.icons.edit}</button>
            <button class="food-card-action-btn" onclick="event.stopPropagation();TT.Food.deleteItem('${item.id}')">${TT.Utils.icons.trash}</button>
          </div>
        </div>
        <div class="food-card-body">
          <div class="food-card-title">${TT.Utils.escapeHtml(item.restaurant || '未知餐厅')}</div>
          <div class="food-card-subtitle">${TT.Utils.escapeHtml(item.city || '')} ${item.date ? '· ' + TT.Utils.formatDate(item.date, 'short') : ''}</div>
          ${item.dishes ? `<div class="food-card-desc">${TT.Utils.escapeHtml(item.dishes)}</div>` : ''}
          <div class="food-card-meta">
            <span>${item.price ? '人均 ¥' + TT.Utils.escapeHtml(String(item.price)) : ''}</span>
            <span>★ ${rating}/5</span>
          </div>
        </div>
      </div>
    `;
  }

  function openEditor(id) {
    const path = currentTab === 'milktea' ? 'food.milktea' : 'food.finedining';
    const items = TT.Store.getCollection(path);
    const item = id ? items.find(i => i.id === id) : null;

    const body = TT.Utils.createEl('div');

    if (currentTab === 'milktea') {
      body.innerHTML = `
        <div class="form-group">
          <label class="form-label">图片</label>
          <div class="image-upload-area" id="food-image-area">
            <div class="image-upload-placeholder">
              ${TT.Utils.icons.image}
              <div>点击上传图片</div>
            </div>
            <input type="file" id="food-image-input" accept="image/*" style="display:none;">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">店名</label>
            <input type="text" class="form-input" id="food-shop" value="${item ? TT.Utils.escapeHtml(item.shop || '') : ''}" placeholder="如：喜茶、奈雪的茶">
          </div>
          <div class="form-group">
            <label class="form-label">饮品名称</label>
            <input type="text" class="form-input" id="food-drink" value="${item ? TT.Utils.escapeHtml(item.drink || '') : ''}" placeholder="如：多肉葡萄">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">评分</label>
            <div class="rating-input" id="food-rating-input">
              ${Array.from({length: 5}, (_, i) => `
                <div class="rating-star ${item && (item.rating || 0) > i ? 'active' : ''}" data-value="${i + 1}">${TT.Utils.icons.star}</div>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">日期</label>
            <input type="date" class="form-input" id="food-date" value="${item ? (item.date || TT.Utils.todayStr()) : TT.Utils.todayStr()}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">评价</label>
          <textarea class="form-textarea" id="food-review" placeholder="写下你的评价..." maxlength="500">${item ? TT.Utils.escapeHtml(item.review || '') : ''}</textarea>
        </div>
      `;
    } else {
      // Fine Dining editor with multi-image support
      const existingImages = item ? (item.images || (item.image ? [item.image] : [])) : [];
      body.innerHTML = `
        <div class="form-group">
          <label class="form-label">图片（可上传多张）</label>
          <div class="multi-image-upload" id="food-image-area">
            <div class="multi-image-grid" id="food-image-grid">
              ${existingImages.map((src, idx) => `
                <div class="multi-image-thumb" data-index="${idx}">
                  <img src="${src}" alt="">
                  <button class="multi-image-remove" onclick="event.stopPropagation();TT.Food.removeImage(${idx})">${TT.Utils.icons.close}</button>
                </div>
              `).join('')}
              <div class="multi-image-add" id="food-image-add">
                ${TT.Utils.icons.image}
                <div>添加图片</div>
              </div>
            </div>
            <input type="file" id="food-image-input" accept="image/*" multiple style="display:none;">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">餐厅名称</label>
            <input type="text" class="form-input" id="food-restaurant" value="${item ? TT.Utils.escapeHtml(item.restaurant || '') : ''}" placeholder="餐厅名称">
          </div>
          <div class="form-group">
            <label class="form-label">城市</label>
            <input type="text" class="form-input" id="food-city" value="${item ? TT.Utils.escapeHtml(item.city || '') : ''}" placeholder="如：上海">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:0 0 150px;">
            <label class="form-label">日期</label>
            <input type="date" class="form-input" id="food-date" value="${item ? (item.date || TT.Utils.todayStr()) : TT.Utils.todayStr()}">
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">人均</label>
            <input type="number" class="form-input" id="food-price" value="${item ? (item.price || '') : ''}" placeholder="人均价格" min="0">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">印象最深的菜</label>
          <input type="text" class="form-input" id="food-dishes" value="${item ? TT.Utils.escapeHtml(item.dishes || '') : ''}" placeholder="品尝的菜品" maxlength="200">
        </div>
        <div class="form-group">
          <label class="form-label">评分</label>
          <div class="rating-input" id="food-rating-input">
            ${Array.from({length: 5}, (_, i) => `
              <div class="rating-star ${item && (item.rating || 0) > i ? 'active' : ''}" data-value="${i + 1}">${TT.Utils.icons.star}</div>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">个人评价</label>
          <textarea class="form-textarea" id="food-review" placeholder="写下你的用餐体验..." maxlength="1000">${item ? TT.Utils.escapeHtml(item.review || '') : ''}</textarea>
        </div>
      `;
    }

    const m = TT.Utils.modal({
      title: id ? '编辑记录' : '新增记录',
      size: 'lg',
      body: body,
      confirmText: id ? '保存' : '创建',
      onConfirm: () => {
        const data = {};
        let rating = 0;
        const activeStars = body.querySelectorAll('.rating-star.active');
        rating = activeStars.length;

        data.rating = rating;
        data.date = document.getElementById('food-date').value;
        data.review = document.getElementById('food-review').value.trim();

        if (currentTab === 'milktea') {
          data.shop = document.getElementById('food-shop').value.trim();
          data.drink = document.getElementById('food-drink').value.trim();
          if (!data.drink) { TT.Utils.toast('请输入饮品名称', 'error'); return false; }
        } else {
          data.restaurant = document.getElementById('food-restaurant').value.trim();
          data.city = document.getElementById('food-city').value.trim();
          data.price = document.getElementById('food-price').value;
          data.dishes = document.getElementById('food-dishes').value.trim();
          if (!data.restaurant) { TT.Utils.toast('请输入餐厅名称', 'error'); return false; }
        }

        // Image(s)
        if (currentTab === 'finedining') {
          const thumbs = body.querySelectorAll('.multi-image-thumb img');
          data.images = Array.from(thumbs).map(img => img.src);
        } else {
          const imgArea = document.getElementById('food-image-area');
          const imgEl = imgArea.querySelector('img');
          if (imgEl) {
            data.image = imgEl.src;
          } else if (item && item.image) {
            data.image = item.image;
          }
        }

        if (id) {
          TT.Store.updateItem(path, id, data);
          TT.Utils.toast('已保存');
        } else {
          TT.Store.addItem(path, data);
          TT.Utils.toast('记录已创建');
        }
        renderContent();
      }
    });

    // Rating stars
    let selectedRating = item ? (item.rating || 0) : 0;
    const stars = m.el.querySelectorAll('.rating-star');
    stars.forEach(star => {
      star.onclick = () => {
        selectedRating = parseInt(star.dataset.value);
        stars.forEach((s, i) => s.classList.toggle('active', i < selectedRating));
      };
    });

    // Image upload
    setupImageUpload(m.el);

    setTimeout(() => {
      const firstInput = m.el.querySelector('.form-input');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  function setupImageUpload(modalEl) {
    if (currentTab === 'finedining') {
      setupMultiImageUpload(modalEl);
    } else {
      setupSingleImageUpload(modalEl);
    }
  }

  function setupSingleImageUpload(modalEl) {
    const area = modalEl.querySelector('#food-image-area');
    const input = modalEl.querySelector('#food-image-input');

    area.onclick = () => input.click();

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        TT.Utils.toast('图片不能超过10MB', 'error');
        return;
      }
      TT.Utils.fileToBase64(file, (base64) => {
        area.classList.add('has-image');
        area.innerHTML = `<img src="${base64}" alt="">`;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'image-remove-btn';
        removeBtn.innerHTML = TT.Utils.icons.close;
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          area.classList.remove('has-image');
          area.innerHTML = `
            <div class="image-upload-placeholder">
              ${TT.Utils.icons.image}
              <div>点击上传图片</div>
            </div>
            <input type="file" id="food-image-input" accept="image/*" style="display:none;">
          `;
          setupSingleImageUpload(modalEl);
        };
        area.appendChild(removeBtn);
      });
    };
  }

  // Multi-image upload state
  let multiImages = [];

  function setupMultiImageUpload(modalEl) {
    const addBtn = modalEl.querySelector('#food-image-add');
    const input = modalEl.querySelector('#food-image-input');

    // Initialize from existing thumbnails
    multiImages = Array.from(modalEl.querySelectorAll('.multi-image-thumb img')).map(img => img.src);

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
    const grid = modalEl.querySelector('#food-image-grid');
    grid.innerHTML = `
      ${multiImages.map((src, idx) => `
        <div class="multi-image-thumb" data-index="${idx}">
          <img src="${src}" alt="">
          <button class="multi-image-remove" onclick="event.stopPropagation();TT.Food.removeImage(${idx})">${TT.Utils.icons.close}</button>
        </div>
      `).join('')}
      <div class="multi-image-add" id="food-image-add">
        ${TT.Utils.icons.image}
        <div>添加图片</div>
      </div>
    `;
    // Re-bind add button
    const addBtn = grid.querySelector('#food-image-add');
    const input = modalEl.querySelector('#food-image-input');
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

  async function deleteItem(id) {
    const path = currentTab === 'milktea' ? 'food.milktea' : 'food.finedining';
    const ok = await TT.Utils.confirm({ title: '删除记录', text: '此记录将被永久删除。' });
    if (ok) {
      TT.Store.removeItem(path, id);
      TT.Utils.toast('已删除');
      renderContent();
    }
  }

  return {
    render,
    editItem: (id) => openEditor(id),
    deleteItem,
    removeImage
  };
})();
