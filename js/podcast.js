/* ============================================
   TT工作台 - Podcast Notes Module
   播客感悟记录
   ============================================ */

window.TT = window.TT || {};

TT.Podcast = (function() {
  let currentCategory = '';
  let searchQuery = '';
  let fabElement = null;
  const expandedNotes = new Set();

  function categoryColorIndex(category) {
    const value = category || '未分类';
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    return Math.abs(hash) % 8;
  }

  function render(container) {
    const categories = TT.Store.getData().podcastCategories;
    if (!categories.includes(currentCategory)) currentCategory = categories[0] || '';

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

    renderCategoryBar();

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

  function renderCategoryBar() {
    const bar = document.getElementById('podcast-categories');
    if (!bar) return;
    const categories = TT.Store.getData().podcastCategories;
    if (!categories.includes(currentCategory)) currentCategory = categories[0] || '';

    bar.innerHTML = `
      ${categories.map(c => `
        <button class="category-chip ${currentCategory === c ? 'active' : ''}" data-cat="${TT.Utils.escapeHtml(c)}">${TT.Utils.escapeHtml(c)}</button>
      `).join('')}
      <button class="category-chip category-manage-btn" id="add-category-btn">
        ${TT.Utils.icons.settings}<span>分类管理</span>
      </button>
    `;

    bar.querySelectorAll('.category-chip[data-cat]').forEach(btn => {
      btn.onclick = () => {
        currentCategory = btn.dataset.cat;
        renderCategoryBar();
        renderGrid();
      };
    });
    bar.querySelector('#add-category-btn').onclick = openCategoryEditor;
  }

  function renderGrid() {
    const grid = document.getElementById('podcast-grid');
    if (!grid) return;

    let notes = TT.Store.getCollection('podcasts');

    // Filter by category
    notes = notes.filter(n => n.category === currentCategory);

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

    grid.innerHTML = notes.map((note, i) => {
      const isExpanded = expandedNotes.has(note.id);
      return `
      <div class="glass-card podcast-card stagger-item ${isExpanded ? 'is-expanded' : ''}" style="animation-delay:${i * 0.05}s" data-id="${note.id}">
        <div class="podcast-card-summary">
          <span class="podcast-card-category cat-color-${categoryColorIndex(note.category)}">${TT.Utils.escapeHtml(note.category || '未分类')}</span>
          <div class="podcast-card-date" title="日期">
            ${TT.Utils.icons.clock}<span>${TT.Utils.formatDate(note.date || note.createdAt)}</span>
          </div>
          <div class="podcast-card-title" title="${TT.Utils.escapeHtml(note.title || '无标题')}">${TT.Utils.escapeHtml(note.title || '无标题')}</div>
          <button class="podcast-card-toggle" type="button" aria-expanded="${isExpanded}" aria-label="${isExpanded ? '收起' : '展开'}感悟记录">
            ${TT.Utils.icons.chevronDown}
          </button>
        </div>
        <div class="podcast-card-details" ${isExpanded ? '' : 'hidden'}>
          <div class="podcast-card-details-main">
            ${note.content
              ? `<div class="podcast-card-preview">${TT.Utils.escapeHtml(note.content).replace(/\n/g, '<br>')}</div>`
              : '<div class="podcast-card-preview podcast-card-preview-empty">暂无感悟内容</div>'}
            ${note.source ? `<div class="podcast-card-source">${TT.Utils.icons.link || ''} 来源：${TT.Utils.escapeHtml(note.source)}</div>` : ''}
          </div>
          <div class="podcast-card-detail-actions">
            <button class="task-action-btn podcast-edit-btn" type="button" title="编辑感悟">${TT.Utils.icons.edit}</button>
            <button class="task-action-btn delete podcast-delete-btn" type="button" title="删除感悟">${TT.Utils.icons.trash}</button>
          </div>
        </div>
      </div>
    `;
    }).join('');

    grid.querySelectorAll('.podcast-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelector('.podcast-card-toggle').onclick = () => {
        if (expandedNotes.has(id)) expandedNotes.delete(id);
        else expandedNotes.add(id);
        renderGrid();
      };
      card.querySelector('.podcast-edit-btn')?.addEventListener('click', () => openEditor(id));
      card.querySelector('.podcast-delete-btn')?.addEventListener('click', () => deleteNote(id));
    });
  }

  function openEditor(id) {
    const notes = TT.Store.getCollection('podcasts');
    const note = id ? notes.find(n => n.id === id) : null;
    const categories = TT.Store.getData().podcastCategories || [];
    let selectedCategory = (note && note.category) || currentCategory || categories[0] || '未分类';
    const categoryOptions = categories.includes(selectedCategory)
      ? categories
      : [selectedCategory, ...categories];

    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">标题</label>
        <input type="text" class="form-input" id="podcast-title" value="${note ? TT.Utils.escapeHtml(note.title) : ''}" maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">分类</label>
        <div class="podcast-category-picker" id="podcast-category-picker" role="group" aria-label="选择感悟分类">
          ${categoryOptions.map(category => `
            <button
              type="button"
              class="category-chip podcast-category-choice ${selectedCategory === category ? 'active' : ''}"
              data-podcast-category="${TT.Utils.escapeHtml(category)}"
              aria-pressed="${selectedCategory === category ? 'true' : 'false'}"
            >${TT.Utils.escapeHtml(category)}</button>
          `).join('')}
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

    body.querySelectorAll('[data-podcast-category]').forEach(btn => {
      btn.onclick = () => {
        selectedCategory = btn.dataset.podcastCategory;
        body.querySelectorAll('[data-podcast-category]').forEach(option => {
          const isSelected = option === btn;
          option.classList.toggle('active', isSelected);
          option.setAttribute('aria-pressed', String(isSelected));
        });
      };
    });

    TT.Utils.modal({
      title: id ? '编辑感悟' : '新建感悟',
      size: 'lg',
      body: body,
      confirmText: id ? '保存' : '创建',
      onConfirm: () => {
        const title = document.getElementById('podcast-title').value.trim();
        const content = document.getElementById('podcast-content').value.trim();
        const date = document.getElementById('podcast-date').value;
        const source = document.getElementById('podcast-source').value.trim();

        if (!title && !content) { TT.Utils.toast('请输入标题或内容', 'error'); return false; }

        const data = { title: title || '无标题', content, category: selectedCategory, date, source };
        if (id) {
          TT.Store.updateItem('podcasts', id, data);
          if (note.category !== selectedCategory) {
            TT.Utils.toast(`已从「${note.category || '未分类'}」移动到「${selectedCategory}」`);
          } else {
            TT.Utils.toast('已保存');
          }
        } else {
          TT.Store.addItem('podcasts', data);
          TT.Utils.toast('感悟已记录');
        }

        // Re-render sidebar badges and grid
        TT.App.renderSidebar();
        renderGrid();
      }
    });

    setTimeout(() => document.getElementById('podcast-title').focus(), 100);
  }

  function openCategoryEditor() {
    const body = TT.Utils.createEl('div');

    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">现有分类</label>
        <div id="cat-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;"></div>
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

    const renderCategoryList = () => {
      const list = m.el.querySelector('#cat-list');
      const categories = TT.Store.getData().podcastCategories;
      list.innerHTML = categories.map(c => `
        <span class="category-manager-item">
          ${TT.Utils.escapeHtml(c)}
          <button type="button" data-delete-podcast-category="${TT.Utils.escapeHtml(c)}" title="删除分类">${TT.Utils.icons.close}</button>
        </span>
      `).join('');
      list.querySelectorAll('[data-delete-podcast-category]').forEach(btn => {
        btn.onclick = async () => {
          const name = btn.dataset.deletePodcastCategory;
          const used = TT.Store.getCollection('podcasts').filter(i => i.category === name).length;
          const ok = await TT.Utils.confirm({
            title: '删除播客分类',
            text: used ? `该分类有 ${used} 条记录，删除后将自动转移到其他分类。` : `确定删除「${name}」分类？`
          });
          if (!ok) return;
          TT.Store.removePodcastCategory(name);
          if (currentCategory === name) currentCategory = TT.Store.getData().podcastCategories[0] || '';
          renderCategoryList();
          renderCategoryBar();
          renderGrid();
          TT.Utils.toast('分类已删除');
        };
      });
    };

    const addCat = () => {
      const name = document.getElementById('new-cat-input').value.trim();
      if (!name) return;
      const categories = TT.Store.getData().podcastCategories;
      if (categories.includes(name)) { TT.Utils.toast('分类已存在', 'error'); return; }
      TT.Store.addPodcastCategory(name);
      renderCategoryList();
      renderCategoryBar();
      renderGrid();
      document.getElementById('new-cat-input').value = '';
      TT.Utils.toast('分类已添加');
    };

    renderCategoryList();
    m.el.querySelector('#add-cat-confirm').onclick = addCat;
    m.el.querySelector('#new-cat-input').onkeydown = (e) => { if (e.key === 'Enter') addCat(); };
  }

  async function deleteNote(id) {
    const ok = await TT.Utils.confirm({ title: '删除感悟', text: '此感悟将被永久删除。' });
    if (ok) {
      TT.Store.removeItem('podcasts', id);
      expandedNotes.delete(id);
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
