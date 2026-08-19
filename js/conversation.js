/* ============================================
   TT工作台 - Conversation Module (谈话记录)
   ============================================ */

window.TT = window.TT || {};

TT.Conversation = (function() {
  let fabElement = null;
  let searchQuery = '';
  let currentCategory = '';
  const expandedItems = new Set();

  function render(container) {
    const categories = TT.Store.getConversationCategories();
    if (!categories.includes(currentCategory)) currentCategory = categories[0] || '';
    container.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <div class="page-title-group">
            <h1>谈话记录</h1>
            <p class="page-subtitle">记录每一次重要对话</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="conversation-add-btn">
              ${TT.Utils.icon('plus', 16)} 新增记录
            </button>
          </div>
        </div>

        <div class="podcast-toolbar">
          <div class="search-box">
            ${TT.Utils.icons.search}
            <input type="text" id="conversation-search" placeholder="搜索谈话记录..." value="${searchQuery}">
          </div>
        </div>

        <div class="album-filter-bar" id="conversation-category-bar">
          ${categories.map(cat => `
            <span class="category-filter-unit">
              <button class="album-filter-chip ${currentCategory === cat ? 'active' : ''}" data-conversation-category="${TT.Utils.escapeHtml(cat)}">
                ${TT.Utils.escapeHtml(cat)}
              </button>
              <button class="category-delete-btn" data-delete-conversation-category="${TT.Utils.escapeHtml(cat)}" title="删除分类">${TT.Utils.icons.close}</button>
            </span>
          `).join('')}
          <button class="album-filter-chip album-filter-add category-manage-btn" id="conversation-add-category" title="分类管理">
            ${TT.Utils.icons.settings}<span>分类管理</span>
          </button>
        </div>

        <div class="conversation-list" id="conversation-list"></div>
      </div>
    `;

    const searchInput = document.getElementById('conversation-search');
    searchInput.oninput = TT.Utils.debounce(() => {
      searchQuery = searchInput.value.trim();
      renderList();
    }, 200);

    container.querySelectorAll('[data-conversation-category]').forEach(btn => {
      btn.onclick = () => {
        currentCategory = btn.dataset.conversationCategory;
        render(container);
      };
    });
    container.querySelectorAll('[data-delete-conversation-category]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        promptDeleteCategory(btn.dataset.deleteConversationCategory, container);
      };
    });
    document.getElementById('conversation-add-category').onclick = () => promptAddCategory(container);

    document.getElementById('conversation-add-btn').onclick = () => openEditor();

    // FAB
    if (fabElement) fabElement.remove();
    fabElement = document.createElement('button');
    fabElement.className = 'fab';
    fabElement.innerHTML = TT.Utils.icons.plus;
    fabElement.title = '新增谈话记录';
    fabElement.onclick = () => openEditor();
    document.body.appendChild(fabElement);

    renderList();
  }

  function renderList() {
    const list = document.getElementById('conversation-list');
    if (!list) return;

    let items = TT.Store.getCollection('conversations');
    items = items.filter(item => (item.category || '大生赛') === currentCategory);

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(n =>
        (n.person || '').toLowerCase().includes(q) ||
        (n.topic || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
      );
    }

    // Sort by date desc
    items = items.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    if (items.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="padding:80px 20px;">
          <div class="empty-state-icon">${TT.Utils.icons.chat}</div>
          <div class="empty-state-text" style="font-size:14px;margin-bottom:4px;">还没有谈话记录</div>
          <div class="empty-state-text">点击右上角新增记录</div>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map((item, i) => {
      const isExpanded = expandedItems.has(item.id);
      return `
      <div class="glass-card conversation-card stagger-item ${isExpanded ? 'is-expanded' : ''}" style="animation-delay:${i * 0.05}s" data-id="${item.id}">
        <div class="conversation-card-summary">
          <div class="conversation-card-person" title="谈话对象">
            ${TT.Utils.icons.chat}
            <span>${TT.Utils.escapeHtml(item.person || '未填写')}</span>
          </div>
          <div class="conversation-card-date" title="日期">
            ${TT.Utils.icons.clock}<span>${item.date ? TT.Utils.formatDate(item.date) : '未填写'}</span>
          </div>
          <div class="conversation-card-topic" title="主题">${TT.Utils.escapeHtml(item.topic || '无主题')}</div>
          <button class="conversation-card-toggle" type="button" aria-expanded="${isExpanded}" aria-label="${isExpanded ? '收起' : '展开'}谈话记录">
            ${TT.Utils.icons.chevronDown}
          </button>
        </div>
        <div class="conversation-card-details" ${isExpanded ? '' : 'hidden'}>
          <div class="conversation-card-actions">
            <button class="task-action-btn conversation-edit-btn" type="button" title="编辑记录">${TT.Utils.icons.edit}</button>
            <button class="task-action-btn delete conversation-delete-btn" type="button" title="删除记录">${TT.Utils.icons.trash}</button>
          </div>
          ${item.content ? `<div class="conversation-card-content">${TT.Utils.escapeHtml(item.content).replace(/\n/g, '<br>')}</div>` : '<div class="conversation-card-content conversation-card-content-empty">暂无具体内容</div>'}
        </div>
      </div>
    `;
    }).join('');

    list.querySelectorAll('.conversation-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelector('.conversation-card-toggle').onclick = () => {
        if (expandedItems.has(id)) expandedItems.delete(id);
        else expandedItems.add(id);
        renderList();
      };
      card.querySelector('.conversation-edit-btn')?.addEventListener('click', () => openEditor(id));
      card.querySelector('.conversation-delete-btn')?.addEventListener('click', () => deleteItem(id));
    });
  }

  function openEditor(id) {
    const items = TT.Store.getCollection('conversations');
    const item = id ? items.find(n => n.id === id) : null;
    const selectedCategory = item ? (item.category || currentCategory) : currentCategory;

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-row" style="display:flex;gap:12px;flex-wrap:wrap;">
        <div class="form-group" style="flex:1;min-width:140px;">
          <label class="form-label">日期</label>
          <input type="date" class="form-input" id="conversation-date" value="${item ? item.date : dateStr}">
        </div>
        <div class="form-group" style="flex:2;min-width:160px;">
          <label class="form-label">和谁谈</label>
          <input type="text" class="form-input" id="conversation-person" value="${item ? TT.Utils.escapeHtml(item.person) : ''}" placeholder="谈话对象" maxlength="50">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">主题</label>
        <input type="text" class="form-input" id="conversation-topic" value="${item ? TT.Utils.escapeHtml(item.topic) : ''}" placeholder="谈话主题" maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">具体内容</label>
        <textarea class="form-textarea" id="conversation-content" style="min-height:180px;" maxlength="10000" placeholder="记录谈话的具体内容...">${item ? TT.Utils.escapeHtml(item.content || '') : ''}</textarea>
      </div>
    `;

    const m = TT.Utils.modal({
      title: item ? '编辑谈话记录' : '新增谈话记录',
      body,
      footer: false
    });

    const footer = TT.Utils.createEl('div', { class: 'modal-footer' });
    footer.style.justifyContent = 'space-between';

    // Left: delete (only when editing)
    if (item) {
      footer.appendChild(TT.Utils.createEl('button', {
        class: 'btn btn-danger',
        text: '删除',
        onclick: async () => {
          const ok = await TT.Utils.confirm({ title: '删除记录', text: '此谈话记录将被永久删除。' });
          if (ok) {
            TT.Store.removeItem('conversations', id);
            m.close();
            renderList();
            TT.Utils.toast('已删除');
          }
        }
      }));
    } else {
      footer.appendChild(TT.Utils.createEl('div'));
    }

    // Right: cancel + save
    const rightGroup = TT.Utils.createEl('div', { style: 'display:flex;gap:8px;' });
    rightGroup.appendChild(TT.Utils.createEl('button', {
      class: 'btn',
      text: '取消',
      onclick: () => m.close()
    }));
    rightGroup.appendChild(TT.Utils.createEl('button', {
      class: 'btn btn-primary',
      text: '保存',
      onclick: () => {
        const date = document.getElementById('conversation-date').value;
        const person = document.getElementById('conversation-person').value.trim();
        const topic = document.getElementById('conversation-topic').value.trim();
        const content = document.getElementById('conversation-content').value.trim();
        const category = selectedCategory;

        if (!person && !topic && !content) {
          TT.Utils.toast('请至少填写一项内容', 'error');
          return;
        }

        if (item) {
          TT.Store.updateItem('conversations', id, { date, person, topic, content, category });
          TT.Utils.toast('已保存');
        } else {
          TT.Store.addItem('conversations', { date, person, topic, content, category });
          TT.Utils.toast('记录已保存');
        }
        m.close();
        renderList();
      }
    }));
    footer.appendChild(rightGroup);

    m.el.appendChild(footer);

    // Auto-focus person for new items
    if (!item) {
      setTimeout(() => {
        const input = document.getElementById('conversation-person');
        if (input) input.focus();
      }, 100);
    }
  }

  async function deleteItem(id) {
    const ok = await TT.Utils.confirm({ title: '删除记录', text: '此谈话记录将被永久删除。' });
    if (ok) {
      TT.Store.removeItem('conversations', id);
      TT.Utils.toast('已删除');
      renderList();
    }
  }

  async function promptAddCategory(container) {
    const name = await TT.Utils.showInput({
      title: '新增谈话分类',
      text: '输入新的分类名称',
      placeholder: '如：家人、朋友、工作'
    });
    if (!name) return;
    if (TT.Store.getConversationCategories().includes(name)) {
      TT.Utils.toast('分类已存在', 'error');
      return;
    }
    TT.Store.addConversationCategory(name);
    currentCategory = name;
    TT.Utils.toast('分类已添加');
    render(container);
  }

  async function promptDeleteCategory(name, container) {
    const used = TT.Store.getCollection('conversations').filter(i => (i.category || '大生赛') === name).length;
    const ok = await TT.Utils.confirm({
      title: '删除谈话分类',
      text: used ? `该分类有 ${used} 条记录，删除后将自动转移到其他分类。` : `确定删除「${name}」分类？`
    });
    if (!ok) return;
    currentCategory = TT.Store.removeConversationCategory(name);
    TT.Utils.toast('分类已删除');
    render(container);
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
    cleanup
  };
})();
