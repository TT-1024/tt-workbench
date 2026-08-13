/* ============================================
   TT工作台 - Learning Module
   保研 / 出国 / 科研
   ============================================ */

window.TT = window.TT || {};

TT.Learning = (function() {
  let currentTab = 'baoyan';

  const tabs = [
    { id: 'baoyan', name: '保研', icon: 'award', path: 'learning.baoyan', color: '#0a84ff' },
    { id: 'chuguo', name: '出国', icon: 'plane', path: 'learning.chuguo', color: '#bf5af2' },
    { id: 'keyan', name: '科研', icon: 'flask', path: 'learning.keyan', color: '#ff9f0a' }
  ];

  const statusOptions = {
    baoyan: [
      { value: 'pending', label: '待完成' },
      { value: 'progress', label: '准备中' },
      { value: 'done', label: '已完成' }
    ],
    chuguo: [
      { value: 'pending', label: '待完成' },
      { value: 'progress', label: '准备中' },
      { value: 'done', label: '已完成' }
    ],
    keyan: [
      { value: 'progress', label: '进行中' },
      { value: 'done', label: '已完成' }
    ]
  };

  const categoryLabels = {
    baoyan: ['目标院校', '申请计划', '时间节点', '材料准备', '联系导师'],
    chuguo: ['学校申请', '签证事项', '文件准备', '语言考试'],
    keyan: ['科研项目', '实验记录', '文献阅读', 'Idea记录', '会议安排']
  };

  function render(container) {
    container.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <div class="page-title-group">
            <h1>学习</h1>
            <p class="page-subtitle">保研 · 出国 · 科研 — 管理你的学习规划</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="learning-add-btn">
              ${TT.Utils.icon('plus', 16)} 新建事项
            </button>
          </div>
        </div>

        <div class="learning-tabs" id="learning-tabs">
          ${tabs.map(t => `
            <button class="learning-tab ${t.id === currentTab ? 'active' : ''}" data-tab="${t.id}">
              ${TT.Utils.icon(t.icon, 16)} ${t.name}
            </button>
          `).join('')}
        </div>

        <div class="learning-content" id="learning-content"></div>
      </div>
    `;

    // Tab events
    container.querySelectorAll('.learning-tab').forEach(btn => {
      btn.onclick = () => {
        currentTab = btn.dataset.tab;
        container.querySelectorAll('.learning-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
        renderContent();
      };
    });

    document.getElementById('learning-add-btn').onclick = () => openEditor();

    renderContent();
  }

  function renderContent() {
    const tab = tabs.find(t => t.id === currentTab);
    const items = TT.Store.getCollection(tab.path);
    const categories = categoryLabels[currentTab];

    const content = document.getElementById('learning-content');

    // Group by category
    const grouped = {};
    categories.forEach(cat => { grouped[cat] = []; });
    items.forEach(item => {
      const cat = item.category || categories[0];
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });

    content.innerHTML = categories.map((cat, ci) => {
      const catItems = grouped[cat] || [];
      if (catItems.length === 0) return '';

      return `
        <div class="learning-section">
          <div class="learning-section-title">${cat}</div>
          <div class="learning-list">
            ${catItems.map((item, i) => {
              const status = item.status || 'pending';
              const statusLabel = (statusOptions[currentTab].find(s => s.value === status) || {}).label || status;
              return `
                <div class="glass-card learning-item stagger-item" style="animation-delay:${(ci * 0.05 + i * 0.03)}s" data-id="${item.id}">
                  <div class="learning-item-icon" style="background:${tab.color}15;color:${tab.color};">
                    ${TT.Utils.icon(tab.icon, 18)}
                  </div>
                  <div class="learning-item-content">
                    <div class="learning-item-title">${TT.Utils.escapeHtml(item.title)}</div>
                    <div class="learning-item-meta">
                      <span class="status-badge status-${status}">${statusLabel}</span>
                      ${item.date ? `<span class="date-badge">${TT.Utils.icons.clock}${TT.Utils.relativeDate(item.date)}</span>` : ''}
                    </div>
                    ${item.note ? `<div class="learning-item-note">${TT.Utils.escapeHtml(item.note)}</div>` : ''}
                  </div>
                  <div class="task-actions" style="opacity:1;">
                    <button class="task-action-btn" onclick="event.stopPropagation();TT.Learning.editItem('${item.id}')">${TT.Utils.icons.edit}</button>
                    <button class="task-action-btn delete" onclick="event.stopPropagation();TT.Learning.deleteItem('${item.id}')">${TT.Utils.icons.trash}</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('') || `
      <div class="empty-state" style="padding:80px 20px;">
        <div class="empty-state-icon">${TT.Utils.icons[tab.icon]}</div>
        <div class="empty-state-text" style="font-size:14px;margin-bottom:8px;">暂无${tab.name}记录</div>
        <div class="empty-state-text">点击右上角「新建事项」开始规划</div>
      </div>
    `;

    // Card click to edit
    content.querySelectorAll('.learning-item').forEach(card => {
      card.onclick = () => TT.Learning.editItem(card.dataset.id);
    });
  }

  function openEditor(id) {
    const tab = tabs.find(t => t.id === currentTab);
    const items = TT.Store.getCollection(tab.path);
    const item = id ? items.find(i => i.id === id) : null;
    const categories = categoryLabels[currentTab];
    const statuses = statusOptions[currentTab];

    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">事项名称</label>
        <input type="text" class="form-input" id="learn-title" value="${item ? TT.Utils.escapeHtml(item.title) : ''}" placeholder="输入事项名称" maxlength="100">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">分类</label>
          <select class="form-select" id="learn-category">
            ${categories.map(c => `<option value="${c}" ${item && item.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">状态</label>
          <select class="form-select" id="learn-status">
            ${statuses.map(s => `<option value="${s.value}" ${item && item.status === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">截止日期</label>
        <input type="date" class="form-input" id="learn-date" value="${item && item.date ? item.date : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">备注</label>
        <textarea class="form-textarea" id="learn-note" placeholder="补充说明..." maxlength="500">${item ? TT.Utils.escapeHtml(item.note || '') : ''}</textarea>
      </div>
    `;

    TT.Utils.modal({
      title: id ? '编辑事项' : '新建事项',
      body: body,
      confirmText: id ? '保存' : '创建',
      onConfirm: () => {
        const title = document.getElementById('learn-title').value.trim();
        if (!title) { TT.Utils.toast('请输入事项名称', 'error'); return false; }
        const data = {
          title,
          category: document.getElementById('learn-category').value,
          status: document.getElementById('learn-status').value,
          date: document.getElementById('learn-date').value,
          note: document.getElementById('learn-note').value.trim()
        };
        if (id) {
          TT.Store.updateItem(tab.path, id, data);
          TT.Utils.toast('已保存');
        } else {
          TT.Store.addItem(tab.path, data);
          TT.Utils.toast('已创建');
        }
        renderContent();
      }
    });

    setTimeout(() => document.getElementById('learn-title').focus(), 100);
  }

  async function deleteItem(id) {
    const tab = tabs.find(t => t.id === currentTab);
    const ok = await TT.Utils.confirm({ title: '删除事项', text: '此事项将被永久删除。' });
    if (ok) {
      TT.Store.removeItem(tab.path, id);
      TT.Utils.toast('已删除');
      renderContent();
    }
  }

  return {
    render,
    editItem: (id) => openEditor(id),
    deleteItem
  };
})();
