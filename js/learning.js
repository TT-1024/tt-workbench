/* ============================================
   TT工作台 - Learning Module
   英语学习 / 保研 / 出国 / 科研
   ============================================ */

window.TT = window.TT || {};

TT.Learning = (function() {
  let currentTab = 'english';
  let englishCalendarDate = new Date();
  let englishPhraseSearch = '';
  let englishPhraseExpansionInitialized = false;
  const expandedEnglishSources = new Set();

  const tabs = [
    { id: 'english', name: '英语学习', icon: 'mic', path: 'learning.englishSpeakingDates', color: '#30d158' },
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
            <p class="page-subtitle">英语学习 · 保研 · 出国 · 科研 — 管理你的学习规划</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="learning-add-btn" style="${currentTab === 'english' ? 'display:none;' : ''}">
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
        const addBtn = document.getElementById('learning-add-btn');
        if (addBtn) addBtn.style.display = currentTab === 'english' ? 'none' : '';
        renderContent();
      };
    });

    document.getElementById('learning-add-btn').onclick = () => openEditor();

    renderContent();
  }

  function renderContent() {
    const tab = tabs.find(t => t.id === currentTab);
    const content = document.getElementById('learning-content');

    if (currentTab === 'english') {
      renderEnglishCalendar(content);
      return;
    }

    const items = TT.Store.getCollection(tab.path);
    const categories = categoryLabels[currentTab];

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

  function renderEnglishCalendar(content) {
    const dates = TT.Store.getCollection('learning.englishSpeakingDates');
    const markedSet = new Set(dates);
    const year = englishCalendarDate.getFullYear();
    const month = englishCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthMarked = dates.filter(d => d.startsWith(monthPrefix)).length;
    const todayStr = TT.Utils.todayStr();

    let html = `
      <div class="milktea-calendar glass-card slide-up">
        <div class="calendar-header">
          <button class="calendar-nav-btn" id="english-cal-prev" aria-label="上个月">${TT.Utils.icons.chevronLeft}</button>
          <div class="calendar-title">${year}年${month + 1}月</div>
          <button class="calendar-nav-btn" id="english-cal-next" aria-label="下个月">${TT.Utils.icons.chevronRight}</button>
        </div>
        <div class="calendar-stats">本月完成 <strong>${monthMarked}</strong> 天口语练习 🎙️　累计 <strong>${dates.length}</strong> 天</div>
        <div class="calendar-weekdays">
          <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
        </div>
        <div class="calendar-grid">
    `;

    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="calendar-day other-month">${daysInPrevMonth - i}</div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const classes = ['calendar-day'];
      if (markedSet.has(dateStr)) classes.push('marked');
      if (dateStr === todayStr) classes.push('today');
      html += `<div class="${classes.join(' ')}" data-date="${dateStr}" role="button" tabindex="0" aria-label="${dateStr}口语练习打卡">${d}</div>`;
    }
    const remaining = (7 - ((firstDay + daysInMonth) % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      html += `<div class="calendar-day other-month">${d}</div>`;
    }

    html += `</div><div class="calendar-hint">完成当天口语练习后，点击日期打卡；再次点击可取消</div></div>`;
    html += renderEnglishPhraseSpace();
    content.innerHTML = html;

    document.getElementById('english-cal-prev').onclick = () => {
      englishCalendarDate = new Date(year, month - 1, 1);
      renderEnglishCalendar(content);
    };
    document.getElementById('english-cal-next').onclick = () => {
      englishCalendarDate = new Date(year, month + 1, 1);
      renderEnglishCalendar(content);
    };
    content.querySelectorAll('.calendar-day[data-date]').forEach(day => {
      const toggle = () => toggleEnglishSpeakingDate(day.dataset.date);
      day.onclick = toggle;
      day.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      };
    });

    bindEnglishPhraseInteractions(content);
  }

  function bindEnglishPhraseInteractions(content) {
    const addButton = document.getElementById('english-phrase-add');
    if (addButton) addButton.onclick = () => openEnglishPhraseEditor();

    content.querySelectorAll('.english-source-add-record').forEach(button => {
      button.onclick = () => openEnglishPhraseEditor(null, button.dataset.source);
    });

    content.querySelectorAll('.english-source-toggle').forEach(button => {
      button.onclick = () => {
        if (englishPhraseSearch) return;
        const source = button.dataset.source;
        const shouldExpand = !expandedEnglishSources.has(source);
        if (shouldExpand) expandedEnglishSources.add(source);
        else expandedEnglishSources.delete(source);
        setEnglishSourceGroupExpanded(button.closest('.english-source-group'), shouldExpand);
      };
    });

    const searchInput = document.getElementById('english-phrase-search');
    if (searchInput) searchInput.oninput = () => {
      englishPhraseSearch = searchInput.value;
      refreshEnglishPhraseSpace(true);
    };

    const expandAll = document.getElementById('english-phrases-expand-all');
    if (expandAll) expandAll.onclick = () => {
      getEnglishPhraseGroups(TT.Store.getCollection('learning.englishPhrases')).forEach(group => expandedEnglishSources.add(group.source));
      content.querySelectorAll('.english-source-group').forEach(group => setEnglishSourceGroupExpanded(group, true));
    };

    const collapseAll = document.getElementById('english-phrases-collapse-all');
    if (collapseAll) collapseAll.onclick = () => {
      expandedEnglishSources.clear();
      englishPhraseExpansionInitialized = true;
      content.querySelectorAll('.english-source-group').forEach(group => setEnglishSourceGroupExpanded(group, false));
    };

    content.querySelectorAll('.english-phrase-edit').forEach(button => {
      button.onclick = () => openEnglishPhraseEditor(button.dataset.id);
    });
    content.querySelectorAll('.english-phrase-favorite').forEach(button => {
      button.onclick = () => toggleEnglishPhraseFavorite(button.dataset.id);
    });
    content.querySelectorAll('.english-phrase-delete').forEach(button => {
      button.onclick = () => deleteEnglishPhrase(button.dataset.id);
    });
  }

  function toggleEnglishSpeakingDate(dateStr) {
    const dates = TT.Store.getCollection('learning.englishSpeakingDates');
    const index = dates.indexOf(dateStr);
    if (index === -1) dates.push(dateStr);
    else dates.splice(index, 1);
    TT.Store.setCollection('learning.englishSpeakingDates', dates);
    renderEnglishCalendar(document.getElementById('learning-content'));
  }

  function renderEnglishPhraseSpace() {
    const phrases = TT.Store.getCollection('learning.englishPhrases');
    const query = englishPhraseSearch.trim().toLowerCase();
    const groups = getEnglishPhraseGroups(phrases, query);
    const hasSources = getEnglishPhraseSourceOptions().length > 0;

    if (!englishPhraseExpansionInitialized && groups.length) {
      expandedEnglishSources.add(groups[0].source);
      englishPhraseExpansionInitialized = true;
    }

    return `
      <section class="english-phrase-space">
        <div class="english-phrase-header">
          <div>
            <h2>好词好句</h2>
            <p>把视频里打动你的表达随手记下来</p>
          </div>
          <button class="btn btn-primary" id="english-phrase-add">${TT.Utils.icon('plus', 16)} 记一句</button>
        </div>
        ${phrases.length || hasSources ? `
          <div class="english-phrase-toolbar">
            <div class="english-phrase-search-wrap">
              ${TT.Utils.icon('search', 15)}
              <input id="english-phrase-search" value="${TT.Utils.escapeHtml(englishPhraseSearch)}" placeholder="搜索英文、中文或来源">
            </div>
            <div class="english-phrase-view-actions">
              <button id="english-phrases-expand-all">全部展开</button>
              <button id="english-phrases-collapse-all">全部收起</button>
            </div>
          </div>
          <div class="english-source-list">
            ${groups.length ? groups.map(group => renderEnglishPhraseGroup(group, !!query)).join('') : `
              <div class="glass-card english-phrase-empty"><div>🔍</div><p>没有找到相关记录</p></div>
            `}
          </div>
        ` : `
          <div class="glass-card english-phrase-empty">
            <div>🎬</div>
            <p>看视频遇到喜欢的表达，就从这里记下第一句吧</p>
          </div>
        `}
      </section>
    `;
  }

  function getEnglishPhraseGroups(phrases, query) {
    const grouped = new Map();
    TT.Store.getCollection('learning.englishPhraseSources').forEach(source => {
      const normalized = String(source || '').trim();
      if (normalized && !grouped.has(normalized)) grouped.set(normalized, []);
    });
    phrases.forEach(item => {
      const source = String(item.source || '').trim();
      if (!grouped.has(source)) grouped.set(source, []);
      grouped.get(source).push(item);
    });

    const groups = [...grouped.entries()].map(([source, items]) => {
      const sortedItems = [...items].sort((a, b) => {
        if (!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1;
        return String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''));
      });
      const latestItem = [...items].sort((a, b) =>
        String(b.updatedAt || b.createdAt || b.date || '').localeCompare(String(a.updatedAt || a.createdAt || a.date || ''))
      )[0];
      return {
        source,
        label: source || '未分类',
        items: sortedItems,
        latestDate: latestItem ? latestItem.date || '' : '',
        latest: sortedItems.reduce((latest, item) => {
          const value = String(item.updatedAt || item.createdAt || item.date || '');
          return value > latest ? value : latest;
        }, '')
      };
    }).sort((a, b) => {
      if (!!a.latest !== !!b.latest) return a.latest ? -1 : 1;
      return b.latest.localeCompare(a.latest) || a.label.localeCompare(b.label, 'zh-CN');
    });

    if (!query) return groups;
    return groups.filter(group =>
      group.source.toLowerCase().includes(query) || group.items.some(item =>
        [item.english, item.chinese].some(value => String(value || '').toLowerCase().includes(query))
      )
    );
  }

  function renderEnglishPhraseGroup(group, forceExpanded) {
    const isExpanded = forceExpanded || expandedEnglishSources.has(group.source);
    return `
      <section class="english-source-group ${isExpanded ? 'expanded' : ''}">
        <div class="glass-card english-source-header">
          <button class="english-source-toggle" data-source="${TT.Utils.escapeHtml(group.source)}" aria-expanded="${isExpanded}">
            <span class="english-source-chevron">${TT.Utils.icons.chevronRight}</span>
            <span class="english-source-name">${TT.Utils.escapeHtml(group.label)}</span>
            <span class="english-source-count">${group.items.length}句</span>
            <span class="english-source-date">${group.latestDate ? `最近 ${TT.Utils.escapeHtml(group.latestDate)}` : '暂无记录'}</span>
          </button>
          <button class="english-source-add-record" data-source="${TT.Utils.escapeHtml(group.source)}" aria-label="在${TT.Utils.escapeHtml(group.label)}中新增记录">${TT.Utils.icon('plus', 16)}</button>
        </div>
        <div class="english-phrase-collapse">
          <div class="english-phrase-list">
            ${group.items.map(item => `
              <article class="glass-card english-phrase-card ${item.favorite ? 'favorite' : ''}">
                <div class="english-phrase-main">
                  <div class="english-phrase-quote">“${TT.Utils.escapeHtml(item.english)}”</div>
                  ${item.chinese ? `<div class="english-phrase-meaning">${TT.Utils.escapeHtml(item.chinese)}</div>` : ''}
                  <div class="english-phrase-meta"><span>${TT.Utils.escapeHtml(item.date || '')}</span></div>
                </div>
                <div class="english-phrase-actions">
                  <button class="task-action-btn english-phrase-edit" data-id="${item.id}" aria-label="编辑">${TT.Utils.icons.edit}</button>
                  <button class="task-action-btn english-phrase-favorite ${item.favorite ? 'is-favorite' : ''}" data-id="${item.id}" aria-label="${item.favorite ? '取消收藏' : '收藏'}">${TT.Utils.icons.star}</button>
                  <button class="task-action-btn delete english-phrase-delete" data-id="${item.id}" aria-label="删除">${TT.Utils.icons.trash}</button>
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function setEnglishSourceGroupExpanded(group, expanded) {
    if (!group) return;
    group.classList.toggle('expanded', expanded);
    const button = group.querySelector('.english-source-toggle');
    if (button) button.setAttribute('aria-expanded', String(expanded));
  }

  function refreshEnglishPhraseSpace(refocusSearch) {
    const section = document.querySelector('.english-phrase-space');
    if (!section) return;
    section.outerHTML = renderEnglishPhraseSpace();
    const content = document.getElementById('learning-content');
    bindEnglishPhraseInteractions(content);
    if (refocusSearch) {
      const input = document.getElementById('english-phrase-search');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }

  function openEnglishPhraseEditor(id, preferredSource) {
    const item = id
      ? TT.Store.getCollection('learning.englishPhrases').find(entry => entry.id === id)
      : null;
    if (id && !item) return;
    const sourceOptions = getEnglishPhraseSourceOptions();
    const selectedSource = item ? String(item.source || '') : String(preferredSource || '');

    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">英文原句</label>
        <textarea class="form-textarea" id="english-phrase-text" placeholder="What a wonderful thought it is..." maxlength="500">${item ? TT.Utils.escapeHtml(item.english) : ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">我的理解（选填）</label>
        <textarea class="form-textarea" id="english-phrase-chinese" placeholder="用自己的话写下中文理解" maxlength="500">${item ? TT.Utils.escapeHtml(item.chinese || '') : ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">分类来源</label>
        <div class="english-source-picker">
          <select class="form-select" id="english-phrase-source">
            <option value="">未分类</option>
            ${sourceOptions.map(source => `<option value="${TT.Utils.escapeHtml(source)}" ${source === selectedSource ? 'selected' : ''}>${TT.Utils.escapeHtml(source)}</option>`).join('')}
          </select>
          <button type="button" class="btn english-source-create" id="english-phrase-source-create" aria-label="新建分类">${TT.Utils.icon('plus', 18)}</button>
        </div>
      </div>
    `;

    TT.Utils.modal({
      title: item ? '编辑好词好句' : '记录好词好句',
      body,
      confirmText: '保存',
      onConfirm: () => {
        const english = document.getElementById('english-phrase-text').value.trim();
        if (!english) {
          TT.Utils.toast('请先写下英文原句', 'error');
          return false;
        }
        const updates = {
          english,
          chinese: document.getElementById('english-phrase-chinese').value.trim(),
          source: document.getElementById('english-phrase-source').value.trim()
        };
        expandedEnglishSources.add(updates.source);
        if (item) {
          TT.Store.updateItem('learning.englishPhrases', item.id, updates);
          TT.Utils.toast('修改已保存');
        } else {
          TT.Store.addItem('learning.englishPhrases', {
            ...updates,
            date: TT.Utils.todayStr(),
            favorite: false
          });
          TT.Utils.toast('已经帮你记下来了');
        }
        renderEnglishCalendar(document.getElementById('learning-content'));
      }
    });
    document.getElementById('english-phrase-source-create').onclick = () => {
      createEnglishPhraseSource(document.getElementById('english-phrase-source'));
    };
    setTimeout(() => document.getElementById('english-phrase-text').focus(), 100);
  }

  function getEnglishPhraseSourceOptions() {
    const saved = TT.Store.getCollection('learning.englishPhraseSources');
    const used = TT.Store.getCollection('learning.englishPhrases').map(item => String(item.source || '').trim()).filter(Boolean);
    return [...new Set([...saved, ...used].map(source => String(source || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }

  async function createEnglishPhraseSource(selectElement) {
    const source = await TT.Utils.showInput({
      title: '新建分类',
      text: '以后新增记录时可以直接选择这个分类',
      placeholder: '例如：TED、老友记 S01E01',
      confirmText: '创建'
    });
    if (!source) return;

    const sources = getEnglishPhraseSourceOptions();
    if (!sources.includes(source)) {
      const saved = TT.Store.getCollection('learning.englishPhraseSources');
      TT.Store.setCollection('learning.englishPhraseSources', [...new Set([...saved, source])]);
      expandedEnglishSources.add(source);
      refreshEnglishPhraseSpace();
      TT.Utils.toast('分类已创建');
    } else {
      TT.Utils.toast('这个分类已经存在');
    }

    if (selectElement && ![...selectElement.options].some(option => option.value === source)) {
      const option = document.createElement('option');
      option.value = source;
      option.textContent = source;
      selectElement.appendChild(option);
    }
    if (selectElement) selectElement.value = source;
  }

  function toggleEnglishPhraseFavorite(id) {
    const item = TT.Store.getCollection('learning.englishPhrases').find(entry => entry.id === id);
    if (!item) return;
    TT.Store.updateItem('learning.englishPhrases', id, { favorite: !item.favorite });
    renderEnglishCalendar(document.getElementById('learning-content'));
  }

  async function deleteEnglishPhrase(id) {
    const ok = await TT.Utils.confirm({ title: '删除这句话', text: '删除后将无法恢复。' });
    if (!ok) return;
    TT.Store.removeItem('learning.englishPhrases', id);
    TT.Utils.toast('已删除');
    renderEnglishCalendar(document.getElementById('learning-content'));
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
