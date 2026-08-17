/* ============================================
   TT工作台 - App Controller, Router, Sidebar, Dashboard
   ============================================ */

window.TT = window.TT || {};

TT.App = (function() {
  let currentRoute = 'dashboard';
  let sidebarModules = [];

  async function init() {
    // Show loading state
    const main = document.getElementById('main-content');
    main.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:60vh;color:var(--text-tertiary);font-size:14px;">正在加载工作台...</div>';

    await TT.Store.load();
    // Establish a safe cloud baseline before rendering any device data.
    await TT.CloudSync.init();

    sidebarModules = TT.Store.getSidebarModules();
    renderSidebar();
    setupSidebarEvents();
    setupMobileMenu();
    navigate('dashboard');
  }

  // ===== Router =====
  function navigate(route) {
    // Cleanup previous module
    if (currentRoute === 'podcast' && route !== 'podcast') {
      if (TT.Podcast.cleanup) TT.Podcast.cleanup();
    }
    if (currentRoute === 'dashboard' && route !== 'dashboard') {
      if (TT.Dashboard.cleanup) TT.Dashboard.cleanup();
    }
    if (currentRoute === 'album' && route !== 'album') {
      if (TT.Album.cleanup) TT.Album.cleanup();
    }
    if (currentRoute === 'inspiration' && route !== 'inspiration') {
      if (TT.Inspiration.cleanup) TT.Inspiration.cleanup();
    }
    if (currentRoute === 'conversation' && route !== 'conversation') {
      if (TT.Conversation.cleanup) TT.Conversation.cleanup();
    }

    currentRoute = route;
    updateActiveNav();

    const main = document.getElementById('main-content');
    main.scrollTop = 0;

    switch (route) {
      case 'dashboard':
        TT.Dashboard.render(main);
        break;
      case 'planning':
        TT.Planning.render(main);
        break;
      case 'learning':
        TT.Learning.render(main);
        break;
      case 'podcast':
        TT.Podcast.render(main);
        break;
      case 'food':
        TT.Food.render(main);
        break;
      case 'album':
        TT.Album.render(main);
        break;
      case 'inspiration':
        TT.Inspiration.render(main);
        break;
      case 'conversation':
        TT.Conversation.render(main);
        break;
      default:
        // Custom module
        if (route.startsWith('custom_')) {
          renderCustomModule(main, route);
        } else {
          TT.Dashboard.render(main);
        }
    }
  }

  // ===== Sidebar =====
  function renderSidebar() {
    sidebarModules = TT.Store.getSidebarModules();
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = '';

    // Core modules
    const coreModules = sidebarModules.filter(m => m.locked);
    const customModules = sidebarModules.filter(m => !m.locked);

    if (coreModules.length) {
      nav.appendChild(createNavSection('模块', coreModules));
    }
    if (customModules.length) {
      nav.appendChild(createNavSection('自定义', customModules));
    }
  }

  function createNavSection(label, modules) {
    const section = document.createElement('div');
    section.className = 'nav-section';

    const labelEl = document.createElement('div');
    labelEl.className = 'nav-section-label';
    labelEl.textContent = label;
    section.appendChild(labelEl);

    modules.forEach(mod => {
      section.appendChild(createNavItem(mod));
    });

    return section;
  }

  function createNavItem(mod) {
    const item = document.createElement('button');
    item.className = 'nav-item';
    item.dataset.route = mod.id;
    if (mod.id === currentRoute) item.classList.add('active');

    item.innerHTML = `
      <span class="nav-item-icon">${TT.Utils.icons[mod.icon] || TT.Utils.icons.folder}</span>
      <span class="nav-item-label">${TT.Utils.escapeHtml(mod.name)}</span>
    `;

    if (!mod.locked) {
      const actions = document.createElement('span');
      actions.className = 'nav-item-actions';

      const editBtn = document.createElement('button');
      editBtn.innerHTML = TT.Utils.icons.edit;
      editBtn.title = '编辑';
      editBtn.onclick = (e) => { e.stopPropagation(); editModule(mod); };

      const delBtn = document.createElement('button');
      delBtn.innerHTML = TT.Utils.icons.trash;
      delBtn.title = '删除';
      delBtn.onclick = (e) => { e.stopPropagation(); deleteModule(mod); };

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      item.appendChild(actions);
    }

    item.onclick = () => {
      navigate(mod.id);
      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('show');
      document.getElementById('sidebar-overlay').classList.remove('show');
    };

    return item;
  }

  function updateActiveNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === currentRoute);
    });
  }

  function setupSidebarEvents() {
    const sidebar = document.getElementById('sidebar');
    // The desktop sidebar is always fully expanded. Clear legacy collapsed state.
    const data = TT.Store.getData();
    sidebar.classList.remove('collapsed');
    if (data.sidebar) data.sidebar.collapsed = false;

    // Add module button
    document.getElementById('add-module-btn').onclick = addModule;

    // Data export/import buttons
    document.getElementById('export-data-btn').onclick = exportDataToFile;
    document.getElementById('import-data-btn').onclick = importDataFromFile;

    // Cloud sync button
    const syncBtn = document.getElementById('cloud-sync-btn');
    if (syncBtn) {
      syncBtn.onclick = () => TT.CloudSync.showTokenSettings();
    }
  }

  function setupMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    const openSidebar = () => {
      sidebar.classList.add('show');
      overlay.classList.add('show');
      menuBtn.setAttribute('aria-expanded', 'true');
    };

    const closeSidebar = () => {
      sidebar.classList.remove('show');
      overlay.classList.remove('show');
      menuBtn.setAttribute('aria-expanded', 'false');
    };

    menuBtn.onclick = openSidebar;
    overlay.onclick = closeSidebar;

    // iOS-style edge swipe: start at the left edge and swipe right.
    const EDGE_ZONE = 28;
    const OPEN_THRESHOLD = 56;
    let edgePointer = null;

    document.addEventListener('pointerdown', (e) => {
      if (!window.matchMedia('(max-width: 768px)').matches || sidebar.classList.contains('show')) return;
      if (document.querySelector('.modal-backdrop, .album-gallery-overlay, .ainews-popup-overlay')) return;
      if (e.isPrimary && e.clientX <= EDGE_ZONE) {
        edgePointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
    });

    document.addEventListener('pointermove', (e) => {
      if (!edgePointer || e.pointerId !== edgePointer.id) return;
      const deltaX = e.clientX - edgePointer.x;
      const deltaY = e.clientY - edgePointer.y;
      if (Math.abs(deltaY) > Math.abs(deltaX) || deltaX < -8) edgePointer = null;
    });

    document.addEventListener('pointerup', (e) => {
      if (!edgePointer || e.pointerId !== edgePointer.id) return;
      const deltaX = e.clientX - edgePointer.x;
      const deltaY = e.clientY - edgePointer.y;
      if (deltaX >= OPEN_THRESHOLD && deltaX > Math.abs(deltaY) * 1.25) openSidebar();
      edgePointer = null;
    });

    document.addEventListener('pointercancel', () => { edgePointer = null; });
  }

  function addModule() {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">目录名称</label>
        <input type="text" class="form-input" id="new-module-name" placeholder="输入目录名称" maxlength="20">
      </div>
      <div class="form-group">
        <label class="form-label">选择图标</label>
        <div class="icon-picker" style="display:flex;flex-wrap:wrap;gap:8px;">
          ${['folder','note','star','heart','target','trending','book','coffee','image','flame','award','plane'].map(name => 
            `<button type="button" class="icon-pick-btn" data-icon="${name}" style="width:40px;height:40px;border:1px solid var(--glass-border);border-radius:var(--radius-sm);background:var(--glass-bg);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);transition:all 0.2s;">${TT.Utils.icons[name]}</button>`
          ).join('')}
        </div>
      </div>
    `;

    const m = TT.Utils.modal({
      title: '新增目录',
      body: body,
      confirmText: '创建',
      onConfirm: () => {
        const name = document.getElementById('new-module-name').value.trim();
        if (!name) {
          TT.Utils.toast('请输入目录名称', 'error');
          return false;
        }
        const selectedIcon = body.querySelector('.icon-pick-btn.selected');
        const icon = selectedIcon ? selectedIcon.dataset.icon : 'folder';
        const id = TT.Store.addSidebarModule(name, icon);
        renderSidebar();
        navigate(id);
        TT.Utils.toast('目录创建成功');
      }
    });

    // Style icon picker buttons
    body.querySelectorAll('.icon-pick-btn').forEach(btn => {
      btn.querySelector('svg').style.width = '20px';
      btn.querySelector('svg').style.height = '20px';
      btn.onclick = () => {
        body.querySelectorAll('.icon-pick-btn').forEach(b => {
          b.style.background = 'var(--glass-bg)';
          b.style.color = 'var(--text-secondary)';
          b.style.borderColor = 'var(--glass-border)';
        });
        btn.style.background = 'var(--accent-blue)';
        btn.style.color = 'white';
        btn.style.borderColor = 'var(--accent-blue)';
        btn.classList.add('selected');
      };
    });

    setTimeout(() => document.getElementById('new-module-name').focus(), 100);
  }

  function editModule(mod) {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">目录名称</label>
        <input type="text" class="form-input" id="edit-module-name" value="${TT.Utils.escapeHtml(mod.name)}" maxlength="20">
      </div>
    `;

    TT.Utils.modal({
      title: '编辑目录',
      body: body,
      confirmText: '保存',
      onConfirm: () => {
        const name = document.getElementById('edit-module-name').value.trim();
        if (!name) {
          TT.Utils.toast('请输入目录名称', 'error');
          return false;
        }
        TT.Store.updateSidebarModule(mod.id, { name });
        renderSidebar();
        updateActiveNav();
        TT.Utils.toast('已保存');
      }
    });
  }

  async function deleteModule(mod) {
    const ok = await TT.Utils.confirm({
      title: `删除「${mod.name}」`,
      text: '该目录及其所有数据将被删除，此操作不可撤销。'
    });
    if (ok) {
      TT.Store.removeSidebarModule(mod.id);
      renderSidebar();
      if (currentRoute === mod.id) navigate('dashboard');
      TT.Utils.toast('目录已删除');
    }
  }

  // ===== Custom Module (generic notes) =====
  function renderCustomModule(container, moduleId) {
    const mod = sidebarModules.find(m => m.id === moduleId);
    const moduleName = mod ? mod.name : '自定义模块';

    const notes = TT.Store.getCollection('notes.' + moduleId);

    container.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <div class="page-title-group">
            <h1>${TT.Utils.escapeHtml(moduleName)}</h1>
            <p class="page-subtitle">记录与整理</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="custom-add-note">
              ${TT.Utils.icon('plus', 16)} 新建笔记
            </button>
          </div>
        </div>
        <div id="custom-notes-grid" class="custom-module-content"></div>
      </div>
    `;

    renderCustomNotes(moduleId);

    document.getElementById('custom-add-note').onclick = () => {
      openNoteEditor(moduleId);
    };
  }

  function renderCustomNotes(moduleId) {
    const grid = document.getElementById('custom-notes-grid');
    if (!grid) return;

    const notes = TT.Store.getCollection('notes.' + moduleId);

    if (notes.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-state-icon">${TT.Utils.icons.note}</div>
          <div class="empty-state-text">还没有笔记，点击右上角创建</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((note, i) => `
      <div class="glass-card note-card stagger-item" style="animation-delay:${i * 0.05}s" data-id="${note.id}">
        <div class="note-card-title">${TT.Utils.escapeHtml(note.title || '无标题')}</div>
        <div class="note-card-content">${TT.Utils.escapeHtml(note.content || '')}</div>
        <div class="note-card-date">${TT.Utils.formatDate(note.createdAt)}</div>
        <div class="podcast-card-actions">
          <button class="task-action-btn" onclick="event.stopPropagation();TT.App.editCustomNote('${moduleId}','${note.id}')">${TT.Utils.icons.edit}</button>
          <button class="task-action-btn delete" onclick="event.stopPropagation();TT.App.deleteCustomNote('${moduleId}','${note.id}')">${TT.Utils.icons.trash}</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.note-card').forEach(card => {
      card.onclick = () => {
        openNoteEditor(moduleId, card.dataset.id);
      };
    });
  }

  function openNoteEditor(moduleId, noteId) {
    const notes = TT.Store.getCollection('notes.' + moduleId);
    const note = noteId ? notes.find(n => n.id === noteId) : null;

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">标题</label>
        <input type="text" class="form-input" id="note-title" value="${note ? TT.Utils.escapeHtml(note.title) : ''}" placeholder="输入标题">
      </div>
      <div class="form-group">
        <label class="form-label">内容</label>
        <textarea class="form-textarea" id="note-content" placeholder="输入内容...">${note ? TT.Utils.escapeHtml(note.content) : ''}</textarea>
      </div>
    `;

    TT.Utils.modal({
      title: noteId ? '编辑笔记' : '新建笔记',
      body: body,
      confirmText: '保存',
      onConfirm: () => {
        const title = document.getElementById('note-title').value.trim();
        const content = document.getElementById('note-content').value.trim();
        if (!title && !content) {
          TT.Utils.toast('请输入内容', 'error');
          return false;
        }
        if (noteId) {
          TT.Store.updateItem('notes.' + moduleId, noteId, { title, content });
          TT.Utils.toast('已保存');
        } else {
          TT.Store.addItem('notes.' + moduleId, { title, content });
          TT.Utils.toast('创建成功');
        }
        renderCustomNotes(moduleId);
      }
    });
  }

  function editCustomNote(moduleId, noteId) {
    openNoteEditor(moduleId, noteId);
  }

  async function deleteCustomNote(moduleId, noteId) {
    const ok = await TT.Utils.confirm({
      title: '删除笔记',
      text: '此笔记将被永久删除。'
    });
    if (ok) {
      TT.Store.removeItem('notes.' + moduleId, noteId);
      renderCustomNotes(moduleId);
      TT.Utils.toast('已删除');
    }
  }

  // ===== Data Export / Import =====
  function exportDataToFile() {
    const json = TT.Store.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const filename = `tt-workbench-${dateStr}.json`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    TT.Utils.toast('数据已导出');
  }

  async function importDataFromFile() {
    const ok = await TT.Utils.confirm({
      title: '导入数据',
      text: '导入将覆盖当前所有数据，请确保已备份。确定继续？',
      confirmText: '确定导入'
    });
    if (!ok) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const text = ev.target.result;
        const success = await TT.Store.importData(text);
        if (success) {
          TT.Utils.toast('数据导入成功，正在刷新...');
          setTimeout(() => location.reload(), 800);
        } else {
          TT.Utils.toast('导入失败：文件格式不正确', 'error');
        }
      };
      reader.onerror = () => TT.Utils.toast('读取文件失败', 'error');
      reader.readAsText(file);
    };
    input.click();
  }

  return {
    init,
    navigate,
    renderSidebar,
    editCustomNote,
    deleteCustomNote
  };
})();

/* ============================================
   Dashboard Module
   ============================================ */

TT.Dashboard = (function() {
  let hotCornerHint = null;
  let touchHandlers = null;
  let mouseHandler = null;
  let isActive = false;

  function render(container) {
    const greeting = TT.Utils.getGreeting();

    container.innerHTML = `
      <div class="page-container dashboard-simple">
        <div id="ainews-bar-container"></div>

        <div class="dashboard-greeting dashboard-greeting-centered slide-up" style="animation-delay:0.05s">
          <h1>${greeting}</h1>
          <p>${TT.Utils.formatDate(new Date(), 'datetime').split(' ')[0]}</p>
        </div>

        <div class="dashboard-avatar-card glass-card slide-up" style="animation-delay:0.15s">
          <div class="dashboard-avatar-frame">
            <img src="assets/avatar.jpg" alt="TT工作台头像" class="dashboard-avatar-img">
          </div>
        </div>
      </div>
    `;

    // Render collapsible AI news bar
    const newsBarContainer = document.getElementById('ainews-bar-container');
    if (newsBarContainer && TT.AINews && TT.AINews.renderCollapsibleBar) {
      TT.AINews.renderCollapsibleBar(newsBarContainer);
    }

    // Show daily AI news popup on first visit each day
    if (TT.AINews && TT.AINews.showDailyPopup) {
      setTimeout(() => TT.AINews.showDailyPopup(), 600);
    }

    // Hot Corner - macOS-style trigger zone
    setupHotCorner();
  }

  // ===== Hot Corner (macOS 触发角) =====
  function setupHotCorner() {
    cleanupHotCorner();
    isActive = true;

    const CORNER_SIZE = 90;       // detection zone (px from each edge)
    const SWIPE_THRESHOLD = 30;   // min swipe distance to trigger (px)
    const HOVER_DELAY = 450;      // desktop mouse hover delay (ms)

    const main = document.getElementById('main-content');
    let touchStartX = 0, touchStartY = 0;
    let inCornerZone = false;
    let triggered = false;
    let mouseTimer = null;

    // Visual hint element
    hotCornerHint = document.createElement('div');
    hotCornerHint.className = 'hot-corner-hint intro';
    hotCornerHint.innerHTML =
      '<div class="hot-corner-icon">' + TT.Utils.icons.lightbulb + '</div>' +
      '<div class="hot-corner-label">滑动记录灵感</div>';
    document.body.appendChild(hotCornerHint);

    // Remove intro class after animation
    setTimeout(() => {
      if (hotCornerHint) hotCornerHint.classList.remove('intro');
    }, 3600);

    // --- Touch gesture (mobile) ---
    function onTouchStart(e) {
      if (!isActive) return;
      const touch = e.touches[0];
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      if (touch.clientX > winW - CORNER_SIZE && touch.clientY > winH - CORNER_SIZE) {
        inCornerZone = true;
        triggered = false;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        if (hotCornerHint) hotCornerHint.classList.add('active');
      }
    }

    function onTouchMove(e) {
      if (!inCornerZone || triggered) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      // Swipe toward center = left and/or up
      if (deltaX < -SWIPE_THRESHOLD || deltaY < -SWIPE_THRESHOLD) {
        triggered = true;
        inCornerZone = false;
        if (hotCornerHint) hotCornerHint.classList.remove('active');
        TT.Inspiration.editItem();
      }
    }

    function onTouchEnd() {
      inCornerZone = false;
      if (hotCornerHint) hotCornerHint.classList.remove('active');
    }

    main.addEventListener('touchstart', onTouchStart, { passive: true });
    main.addEventListener('touchmove', onTouchMove, { passive: true });
    main.addEventListener('touchend', onTouchEnd, { passive: true });

    // --- Mouse hot corner (desktop) ---
    function onMouseMove(e) {
      if (!isActive) return;
      // Skip if modal is already open
      if (document.querySelector('.modal-overlay')) {
        if (mouseTimer) { clearTimeout(mouseTimer); mouseTimer = null; }
        if (hotCornerHint) hotCornerHint.classList.remove('active');
        return;
      }
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      if (e.clientX > winW - CORNER_SIZE && e.clientY > winH - CORNER_SIZE) {
        if (!mouseTimer) {
          if (hotCornerHint) hotCornerHint.classList.add('active');
          mouseTimer = setTimeout(() => {
            TT.Inspiration.editItem();
            mouseTimer = null;
          }, HOVER_DELAY);
        }
      } else {
        if (mouseTimer) {
          clearTimeout(mouseTimer);
          mouseTimer = null;
        }
        if (hotCornerHint) hotCornerHint.classList.remove('active');
      }
    }

    main.addEventListener('mousemove', onMouseMove);

    touchHandlers = { start: onTouchStart, move: onTouchMove, end: onTouchEnd };
    mouseHandler = onMouseMove;
  }

  function cleanupHotCorner() {
    isActive = false;
    const main = document.getElementById('main-content');
    if (touchHandlers) {
      main.removeEventListener('touchstart', touchHandlers.start);
      main.removeEventListener('touchmove', touchHandlers.move);
      main.removeEventListener('touchend', touchHandlers.end);
      touchHandlers = null;
    }
    if (mouseHandler) {
      main.removeEventListener('mousemove', mouseHandler);
      mouseHandler = null;
    }
    if (hotCornerHint) {
      hotCornerHint.remove();
      hotCornerHint = null;
    }
  }

  function cleanup() {
    cleanupHotCorner();
  }

  return { render, cleanup };
})();
