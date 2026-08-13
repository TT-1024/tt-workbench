/* ============================================
   TT工作台 - Podcast Notes Module
   播客感悟记录
   ============================================ */

window.TT = window.TT || {};

TT.Podcast = (function() {
  let currentCategory = 'all';
  let searchQuery = '';
  let fabElement = null;

  function render(container) {
    const categories = TT.Store.getData().podcastCategories;

    container.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <div class="page-title-group">
            <h1>播客感悟记录</h1>
            <p class="page-subtitle">记录听播客后的思考与启发</p>
          </div>
        </div>

        <div class="podcast-toolbar">
          <div class="search-box">
            ${TT.Utils.icons.search}
            <input type="text" id="podcast-search" placeholder="搜索感悟..." value="${searchQuery}">
          </div>
          <div class="category-chips" id="podcast-categories">
            <button class="category-chip ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">全部</button>
            ${categories.map(c => `
              <button class="category-chip ${currentCategory === c ? 'active' : ''}" data-cat="${c}">${c}</button>
            `).join('')}
            <button class="category-chip" id="add-category-btn" style="color:var(--text-tertiary);border-style:dashed;">+ 分类</button>
          </div>
        </div>

        <div class="podcast-grid" id="podcast-grid"></div>
      </div>
    `;

    // Search
    const searchInput = document.getElementById('podcast-search');
    searchInput.oninput = TT.Utils.debounce(() => {
      searchQuery = searchInput.value.trim();
      renderGrid();
    }, 200);

    // Category filter
    container.querySelectorAll('.category-chip[data-cat]').forEach(btn => {
      btn.onclick = () => {
        currentCategory = btn.dataset.cat;
        container.querySelectorAll('.category-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderGrid();
      };
    });

    // Add category
    document.getElementById('add-category-btn').onclick = openCategoryEditor;

    // FAB
    if (fabElement) fabElement.remove();
    fabElement = document.createElement('button');
    fabElement.className = 'fab';
    fabElement.innerHTML = TT.Utils.icons.plus;
    fabElement.title = '新建感悟';
    fabElement.onclick = () => openEditor();
    document.body.appendChild(fabElement);

    renderGrid();
  }

  function renderGrid() {
    const grid = document.getElementById('podcast-grid');
    if (!grid) return;

    let notes = TT.Store.getCollection('podcasts');

    // Filter by category
    if (currentCategory !== 'all') {
      notes = notes.filter(n => n.category === currentCategory);
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      notes = notes.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q) ||
        (n.source || '').toLowerCase().includes(q)
      );
    }

    // Sort by date desc
    notes = notes.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    if (notes.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:80px 20px;">
          <div class="empty-state-icon">${TT.Utils.icons.mic}</div>
          <div class="empty-state-text" style="font-size:14px;margin-bottom:4px;">暂无感悟记录</div>
          <div class="empty-state-text">点击右下角 + 按钮创建</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = notes.map((note, i) => `
      <div class="glass-card podcast-card stagger-item" style="animation-delay:${i * 0.05}s" data-id="${note.id}">
        <div class="podcast-card-actions">
          <button class="task-action-btn" onclick="event.stopPropagation();TT.Podcast.editNote('${note.id}')">${TT.Utils.icons.edit}</button>
          <button class="task-action-btn delete" onclick="event.stopPropagation();TT.Podcast.deleteNote('${note.id}')">${TT.Utils.icons.trash}</button>
        </div>
        <span class="podcast-card-category cat-${TT.Utils.escapeHtml(note.category || '')}">${TT.Utils.escapeHtml(note.category || '未分类')}</span>
        <div class="podcast-card-title">${TT.Utils.escapeHtml(note.title || '无标题')}</div>
        <div class="podcast-card-preview">${TT.Utils.escapeHtml(note.content || '')}</div>
        ${note.source ? `<div class="podcast-card-source">${TT.Utils.icons.link || ''} 来源：${TT.Utils.escapeHtml(note.source)}</div>` : ''}
        <div class="podcast-card-date">
          ${TT.Utils.icons.clock} ${TT.Utils.formatDate(note.date || note.createdAt)}
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.podcast-card').forEach(card => {
      card.onclick = () => TT.Podcast.editNote(card.dataset.id);
    });
  }

  function openEditor(id) {
    const notes = TT.Store.getCollection('podcasts');
    const note = id ? notes.find(n => n.id === id) : null;
    const categories = TT.Store.getData().podcastCategories;

    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">标题</label>
        <input type="text" class="form-input" id="podcast-title" value="${note ? TT.Utils.escapeHtml(note.title) : ''}" maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">分类</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <select class="form-select" id="podcast-category" style="flex:1;">
            ${categories.map(c => `<option value="${c}" ${note && note.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <button class="btn" type="button" id="podcast-new-cat" style="white-space:nowrap;">+ 新分类</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">正文内容</label>
        <textarea class="form-textarea" id="podcast-content" style="min-height:180px;" maxlength="5000">${note ? TT.Utils.escapeHtml(note.content || '') : ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">来源</label>
        <input type="text" class="form-input" id="podcast-source" value="${note ? TT.Utils.escapeHtml(note.source || '') : ''}" maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">日期</label>
        <input type="date" class="form-input" id="podcast-date" value="${note ? (note.date || TT.Utils.todayStr()) : TT.Utils.todayStr()}">
      </div>
    `;

    const m = TT.Utils.modal({
      title: id ? '编辑感悟' : '新建感悟',
      size: 'lg',
      body: body,
      confirmText: id ? '保存' : '创建',
      onConfirm: () => {
        const title = document.getElementById('podcast-title').value.trim();
        const content = document.getElementById('podcast-content').value.trim();
        const category = document.getElementById('podcast-category').value;
        const date = document.getElementById('podcast-date').value;
        const source = document.getElementById('podcast-source').value.trim();

        if (!title && !content) { TT.Utils.toast('请输入标题或内容', 'error'); return false; }

        const data = { title: title || '无标题', content, category, date, source };
        if (id) {
          TT.Store.updateItem('podcasts', id, data);
          TT.Utils.toast('已保存');
        } else {
          TT.Store.addItem('podcasts', data);
          TT.Utils.toast('感悟已记录');
        }

        // Re-render sidebar badges and grid
        TT.App.renderSidebar();
        renderGrid();
      }
    });

    // New category button
    m.el.querySelector('#podcast-new-cat').onclick = () => {
      const catBody = TT.Utils.createEl('div');
      catBody.innerHTML = `
        <div class="form-group">
          <label class="form-label">分类名称</label>
          <input type="text" class="form-input" id="new-cat-name" placeholder="输入分类名称" maxlength="10">
        </div>
      `;
      TT.Utils.modal({
        title: '新建分类',
        size: 'sm',
        body: catBody,
        confirmText: '添加',
        onConfirm: () => {
          const name = document.getElementById('new-cat-name').value.trim();
          if (!name) { TT.Utils.toast('请输入分类名称', 'error'); return false; }
          if (categories.includes(name)) { TT.Utils.toast('分类已存在', 'error'); return false; }
          TT.Store.addPodcastCategory(name);
          // Update select
          const select = document.getElementById('podcast-category');
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          opt.selected = true;
          select.appendChild(opt);
          TT.Utils.toast('分类已添加');
        }
      });
      setTimeout(() => document.getElementById('new-cat-name').focus(), 100);
    };

    setTimeout(() => document.getElementById('podcast-title').focus(), 100);
  }

  function openCategoryEditor() {
    const categories = TT.Store.getData().podcastCategories;
    const body = TT.Utils.createEl('div');

    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">现有分类</label>
        <div id="cat-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          ${categories.map(c => `
            <span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--glass-bg-active);border-radius:var(--radius-full);font-size:13px;">
              ${TT.Utils.escapeHtml(c)}
              <button type="button" onclick="this.parentElement.remove();TT.Store.removePodcastCategory('${c}');" style="border:none;background:transparent;cursor:pointer;color:var(--text-tertiary);display:flex;">${TT.Utils.icons.close}</button>
            </span>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">添加新分类</label>
        <div style="display:flex;gap:8px;">
          <input type="text" class="form-input" id="new-cat-input" placeholder="分类名称" maxlength="10">
          <button class="btn btn-primary" type="button" id="add-cat-confirm" style="white-space:nowrap;">添加</button>
        </div>
      </div>
    `;

    const m = TT.Utils.modal({
      title: '管理分类',
      size: 'sm',
      body: body,
      confirmText: false,
      cancelText: '完成'
    });

    const addCat = () => {
      const name = document.getElementById('new-cat-input').value.trim();
      if (!name) return;
      if (categories.includes(name)) { TT.Utils.toast('分类已存在', 'error'); return; }
      TT.Store.addPodcastCategory(name);
      categories.push(name);
      const span = document.createElement('span');
      span.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--glass-bg-active);border-radius:var(--radius-full);font-size:13px;';
      span.innerHTML = `${TT.Utils.escapeHtml(name)} <button type="button" style="border:none;background:transparent;cursor:pointer;color:var(--text-tertiary);display:flex;">${TT.Utils.icons.close}</button>`;
      span.querySelector('button').onclick = () => { span.remove(); TT.Store.removePodcastCategory(name); };
      document.getElementById('cat-list').appendChild(span);
      document.getElementById('new-cat-input').value = '';
      TT.Utils.toast('分类已添加');
    };

    m.el.querySelector('#add-cat-confirm').onclick = addCat;
    m.el.querySelector('#new-cat-input').onkeydown = (e) => { if (e.key === 'Enter') addCat(); };
  }

  async function deleteNote(id) {
    const ok = await TT.Utils.confirm({ title: '删除感悟', text: '此感悟将被永久删除。' });
    if (ok) {
      TT.Store.removeItem('podcasts', id);
      TT.Utils.toast('已删除');
      TT.App.renderSidebar();
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
    editNote: (id) => openEditor(id),
    deleteNote,
    cleanup
  };
})();
