/* ============================================
   TT工作台 - Inspiration Module (灵感记录)
   ============================================ */

window.TT = window.TT || {};

TT.Inspiration = (function() {
  let fabElement = null;
  let searchQuery = '';
  let currentTag = 'all';
  const NOTE_WIDTH = 240;
  const NOTE_HEIGHT = 210;
  const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'white'];

  function render(container) {
    const tags = getAllTags();
    container.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <div class="page-title-group">
            <h1>灵感</h1>
            <p class="page-subtitle">捕捉每一个转瞬即逝的想法</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="inspiration-add-btn">
              ${TT.Utils.icon('plus', 16)} 记录灵感
            </button>
          </div>
        </div>

        <div class="podcast-toolbar">
          <div class="search-box">
            ${TT.Utils.icons.search}
            <input type="text" id="inspiration-search" placeholder="搜索灵感..." value="${searchQuery}">
          </div>
          <div class="category-chips" id="inspiration-tags">
            <button class="category-chip ${currentTag === 'all' ? 'active' : ''}" data-tag="all">全部</button>
            ${tags.map(t => `
              <button class="category-chip ${currentTag === t ? 'active' : ''}" data-tag="${TT.Utils.escapeHtml(t)}">${TT.Utils.escapeHtml(t)}</button>
            `).join('')}
          </div>
        </div>

        <div class="inspiration-board-shell" id="inspiration-board-shell">
          <div class="inspiration-board" id="inspiration-grid"></div>
        </div>
      </div>
    `;

    // Search
    const searchInput = document.getElementById('inspiration-search');
    searchInput.oninput = TT.Utils.debounce(() => {
      searchQuery = searchInput.value.trim();
      renderGrid();
    }, 200);

    // Tag filter
    container.querySelectorAll('.category-chip[data-tag]').forEach(btn => {
      btn.onclick = () => {
        currentTag = btn.dataset.tag;
        container.querySelectorAll('.category-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderGrid();
      };
    });

    document.getElementById('inspiration-add-btn').onclick = () => openEditor();

    // FAB
    if (fabElement) fabElement.remove();
    fabElement = document.createElement('button');
    fabElement.className = 'fab';
    fabElement.innerHTML = TT.Utils.icons.plus;
    fabElement.title = '记录灵感';
    fabElement.onclick = () => openEditor();
    document.body.appendChild(fabElement);

    renderGrid();
  }

  function getAllTags() {
    const items = TT.Store.getCollection('inspirations');
    const tagSet = new Set();
    items.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(t => tagSet.add(t));
      }
    });
    return Array.from(tagSet).sort();
  }

  function renderGrid() {
    const grid = document.getElementById('inspiration-grid');
    if (!grid) return;

    let items = TT.Store.getCollection('inspirations');

    // Filter by tag
    if (currentTag !== 'all') {
      items = items.filter(n => n.tags && n.tags.includes(currentTag));
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
      );
    }

    // Keep a predictable order for legacy notes that do not have a saved position yet.
    items = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="inspiration-board-empty">
          <div class="empty-state-icon">${TT.Utils.icons.lightbulb}</div>
          <div class="empty-state-text" style="font-size:14px;margin-bottom:4px;">还没有灵感记录</div>
          <div class="empty-state-text">点击 +，在画布上贴下第一张便签</div>
        </div>
      `;
      return;
    }

    const positions = items.map((item, i) => getBoardPosition(item, i));
    const boardWidth = Math.max(1200, ...positions.map(p => p.x + NOTE_WIDTH + 80));
    const boardHeight = Math.max(760, ...positions.map(p => p.y + NOTE_HEIGHT + 100));
    grid.style.width = `${boardWidth}px`;
    grid.style.height = `${boardHeight}px`;

    grid.innerHTML = items.map((item, i) => {
      const pos = positions[i];
      const color = NOTE_COLORS.includes(item.color) ? item.color : NOTE_COLORS[i % 4];
      return `
      <div class="inspiration-card inspiration-note inspiration-note-${color}" style="left:${pos.x}px;top:${pos.y}px;z-index:${Number(item.boardZ) || i + 1}" data-id="${item.id}">
        <button class="inspiration-drag-handle" type="button" aria-label="拖动便签" title="拖动便签">
          <span></span><span></span><span></span>
        </button>
        <div class="podcast-card-actions">
          <button class="task-action-btn" onclick="event.stopPropagation();TT.Inspiration.editItem('${item.id}')">${TT.Utils.icons.edit}</button>
          <button class="task-action-btn delete" onclick="event.stopPropagation();TT.Inspiration.deleteItem('${item.id}')">${TT.Utils.icons.trash}</button>
        </div>
        ${item.title ? `<div class="inspiration-card-title">${TT.Utils.escapeHtml(item.title)}</div>` : ''}
        <div class="podcast-card-preview">${TT.Utils.escapeHtml(item.content || '')}</div>
        ${item.tags && item.tags.length > 0 ? `
          <div class="inspiration-tags">
            ${item.tags.map(t => `<span class="inspiration-tag">${TT.Utils.escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
        <div class="podcast-card-date">
          ${TT.Utils.icons.clock} ${TT.Utils.formatDate(item.createdAt)}
        </div>
      </div>
    `;
    }).join('');

    grid.querySelectorAll('.inspiration-card').forEach(card => {
      card.onclick = () => TT.Inspiration.editItem(card.dataset.id);
      setupNoteDrag(card, grid);
    });
  }

  function getBoardPosition(item, index) {
    if (Number.isFinite(Number(item.boardX)) && Number.isFinite(Number(item.boardY))) {
      return { x: Number(item.boardX), y: Number(item.boardY) };
    }
    const col = index % 4;
    const row = Math.floor(index / 4);
    return { x: 32 + col * 270, y: 32 + row * 240 };
  }

  function setupNoteDrag(card, board) {
    const handle = card.querySelector('.inspiration-drag-handle');
    handle.addEventListener('click', e => e.stopPropagation());
    handle.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const initialX = parseFloat(card.style.left) || 0;
      const initialY = parseFloat(card.style.top) || 0;
      const topZ = Math.max(1, ...Array.from(board.querySelectorAll('.inspiration-note')).map(n => Number(n.style.zIndex) || 1)) + 1;
      card.style.zIndex = topZ;
      card.classList.add('is-dragging');
      handle.setPointerCapture(e.pointerId);

      const move = event => {
        const x = Math.max(12, Math.min(board.clientWidth - card.offsetWidth - 12, initialX + event.clientX - startX));
        const y = Math.max(12, Math.min(board.clientHeight - card.offsetHeight - 12, initialY + event.clientY - startY));
        card.style.left = `${x}px`;
        card.style.top = `${y}px`;
      };
      const end = event => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        card.classList.remove('is-dragging');
        TT.Store.updateItem('inspirations', card.dataset.id, {
          boardX: Math.round(parseFloat(card.style.left) || 0),
          boardY: Math.round(parseFloat(card.style.top) || 0),
          boardZ: topZ
        });
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  }

  function openEditor(id) {
    const items = TT.Store.getCollection('inspirations');
    const item = id ? items.find(n => n.id === id) : null;

    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">标题（可选）</label>
        <input type="text" class="form-input" id="inspiration-title" value="${item ? TT.Utils.escapeHtml(item.title) : ''}" maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">灵感内容</label>
        <textarea class="form-textarea" id="inspiration-content" style="min-height:200px;" maxlength="5000" autofocus>${item ? TT.Utils.escapeHtml(item.content || '') : ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">标签（逗号分隔，可选）</label>
        <input type="text" class="form-input" id="inspiration-tags-input" value="${item && item.tags ? item.tags.map(t => TT.Utils.escapeHtml(t)).join(', ') : ''}" maxlength="200">
      </div>
      <div class="form-group">
        <label class="form-label">便签颜色</label>
        <div class="inspiration-color-picker">
          ${NOTE_COLORS.map((color, index) => `
            <label class="inspiration-color-option inspiration-note-${color}" title="选择颜色">
              <input type="radio" name="inspiration-color" value="${color}" ${(item ? (item.color || 'yellow') === color : index === 0) ? 'checked' : ''}>
              <span></span>
            </label>
          `).join('')}
        </div>
      </div>
    `;

    const m = TT.Utils.modal({
      title: item ? '编辑灵感' : '记录灵感',
      body,
      footer: false
    });

    const footer = TT.Utils.createEl('div', { class: 'modal-footer' });
    footer.style.justifyContent = 'space-between';

    // Left: delete button (only when editing)
    if (item) {
      footer.appendChild(TT.Utils.createEl('button', {
        class: 'btn btn-danger',
        text: '删除',
        onclick: async () => {
          const ok = await TT.Utils.confirm({ title: '删除灵感', text: '此灵感将被永久删除。' });
          if (ok) {
            TT.Store.removeItem('inspirations', id);
            m.close();
            renderGrid();
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
        const title = document.getElementById('inspiration-title').value.trim();
        const content = document.getElementById('inspiration-content').value.trim();
        const tagsStr = document.getElementById('inspiration-tags-input').value.trim();
        const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
        const color = body.querySelector('input[name="inspiration-color"]:checked')?.value || 'yellow';

        if (!title && !content) {
          TT.Utils.toast('请输入灵感内容', 'error');
          return;
        }

        if (item) {
          TT.Store.updateItem('inspirations', id, { title, content, tags, color });
          TT.Utils.toast('已保存');
        } else {
          const shell = document.getElementById('inspiration-board-shell');
          const offset = TT.Store.getCollection('inspirations').length % 5;
          TT.Store.addItem('inspirations', {
            title, content, tags, color,
            boardX: Math.max(24, (shell?.scrollLeft || 0) + 36 + offset * 24),
            boardY: Math.max(24, (shell?.scrollTop || 0) + 36 + offset * 24)
          });
          TT.Utils.toast('灵感已记录');
        }
        m.close();
        renderGrid();
      }
    }));
    footer.appendChild(rightGroup);

    m.el.appendChild(footer);

    // Auto-focus content for new items
    if (!item) {
      setTimeout(() => {
        const ta = document.getElementById('inspiration-content');
        if (ta) ta.focus();
      }, 100);
    }
  }

  async function deleteItem(id) {
    const ok = await TT.Utils.confirm({ title: '删除灵感', text: '此灵感将被永久删除。' });
    if (ok) {
      TT.Store.removeItem('inspirations', id);
      TT.Utils.toast('已删除');
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
    cleanup
  };
})();
