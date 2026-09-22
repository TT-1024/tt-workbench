/* ============================================
   TT工作台 - BCI Module
   ============================================ */

window.TT = window.TT || {};

TT.BCI = (function() {
  let searchQuery = '';
  let currentFilter = 'all';
  let captureKind = 'basics';
  let voiceRecognition = null;
  let isVoiceListening = false;

  const KINDS = {
    basics: { label: '基本知识', icon: 'book', prompt: '记录一条 BCI 基本知识…' },
    development: { label: '目前发展现状', icon: 'trending', prompt: '记录 BCI 的最新进展与现状…' },
    industry: { label: '行业分析', icon: 'database', prompt: '记录公司、产业链或市场判断…' },
    question: { label: '疑问', icon: 'chat', prompt: '记下一个需要进一步研究的问题…' }
  };

  function render(container) {
    container.innerHTML = `
      <div class="page-container thoughts-page bci-page">
        <div class="page-header">
          <div class="page-title-group">
            <h1>BCI</h1>
            <p class="page-subtitle">整理脑机接口的知识、进展、行业判断与待解问题</p>
          </div>
          <button class="btn btn-primary thoughts-new-btn" id="bci-new-btn">${TT.Utils.icons.plus} 记一条</button>
        </div>

        <section class="thoughts-capture bci-capture" aria-label="快速记录 BCI 内容">
          <div class="thoughts-kind-switch bci-kind-switch" role="group" aria-label="BCI 内容类型">
            ${renderKindButtons('capture')}
          </div>
          <div class="thoughts-capture-row">
            <button class="thoughts-voice-btn" id="bci-voice-btn" type="button" aria-label="开始语音输入" aria-pressed="false">${TT.Utils.icons.mic}</button>
            <textarea class="thoughts-quick-input" id="bci-quick-input" rows="1" maxlength="5000" placeholder="${KINDS[captureKind].prompt}" autocomplete="off" inputmode="text" x-webkit-speech speech></textarea>
            <button class="thoughts-send-btn bci-send-btn" id="bci-send-btn" type="button" aria-label="保存 BCI 记录">${TT.Utils.icons.arrowUp}</button>
          </div>
          <div class="thoughts-voice-status" id="bci-voice-status">按下麦克风开始说，或直接输入文字</div>
        </section>

        <div class="thoughts-toolbar bci-toolbar">
          <div class="search-box thoughts-search-box">
            ${TT.Utils.icons.search}
            <input type="text" id="bci-search" placeholder="搜索 BCI 内容...">
          </div>
          <div class="thoughts-filter bci-filter" role="group" aria-label="筛选 BCI 内容">
            <button class="thoughts-filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-bci-filter="all">全部</button>
            ${Object.entries(KINDS).map(([kind, config]) => `
              <button class="thoughts-filter-btn ${currentFilter === kind ? 'active' : ''}" data-bci-filter="${kind}">${config.label}</button>
            `).join('')}
          </div>
        </div>

        <div class="thoughts-list" id="bci-list"></div>
      </div>
    `;

    setupCapture();
    setupToolbar(container);
    document.getElementById('bci-new-btn').onclick = () => openEditor();
    renderList();
  }

  function renderKindButtons(context, selectedKind) {
    const selected = selectedKind || captureKind;
    return Object.entries(KINDS).map(([kind, config]) => `
      <button type="button" class="thoughts-kind-btn ${selected === kind ? 'active' : ''}" data-bci-kind="${kind}" data-bci-kind-context="${context}" aria-pressed="${selected === kind}">
        ${TT.Utils.icons[config.icon]} ${config.label}
      </button>
    `).join('');
  }

  function setupCapture() {
    const input = document.getElementById('bci-quick-input');
    const sendButton = document.getElementById('bci-send-btn');
    const voiceButton = document.getElementById('bci-voice-btn');

    document.querySelectorAll('[data-bci-kind-context="capture"]').forEach(button => {
      button.onclick = () => {
        captureKind = button.dataset.bciKind;
        document.querySelectorAll('[data-bci-kind-context="capture"]').forEach(candidate => {
          const active = candidate.dataset.bciKind === captureKind;
          candidate.classList.toggle('active', active);
          candidate.setAttribute('aria-pressed', String(active));
        });
        input.placeholder = KINDS[captureKind].prompt;
        input.focus();
      };
    });

    sendButton.onclick = addQuickEntry;
    input.oninput = () => autoSizeInput(input);
    input.onkeydown = event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        addQuickEntry();
      }
    };
    voiceButton.onclick = toggleVoiceInput;
  }

  function setupToolbar(container) {
    const searchInput = document.getElementById('bci-search');
    searchInput.value = searchQuery;
    searchInput.oninput = TT.Utils.debounce(() => {
      searchQuery = searchInput.value.trim();
      renderList();
    }, 180);

    container.querySelectorAll('[data-bci-filter]').forEach(button => {
      button.onclick = () => {
        currentFilter = button.dataset.bciFilter;
        container.querySelectorAll('[data-bci-filter]').forEach(candidate => {
          candidate.classList.toggle('active', candidate === button);
        });
        renderList();
      };
    });
  }

  function autoSizeInput(input) {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  function addQuickEntry() {
    const input = document.getElementById('bci-quick-input');
    const content = input.value.trim();
    if (!content) {
      TT.Utils.toast('请先输入一条 BCI 内容', 'error');
      input.focus();
      return;
    }

    TT.Store.addItem('bci', { kind: captureKind, content });
    input.value = '';
    autoSizeInput(input);
    TT.Utils.toast(`已保存到“${KINDS[captureKind].label}”`);
    renderList();
    input.focus();
  }

  function toggleVoiceInput() {
    if (isVoiceListening && voiceRecognition) {
      voiceRecognition.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      TT.Utils.toast('当前浏览器暂不支持语音转文字，请使用系统键盘的麦克风', 'error');
      document.getElementById('bci-quick-input')?.focus();
      return;
    }

    voiceRecognition = new SpeechRecognition();
    voiceRecognition.lang = 'zh-CN';
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = true;
    voiceRecognition.onstart = () => setVoiceListeningState(true, `正在听，请说出你的${KINDS[captureKind].label}…`);
    voiceRecognition.onresult = event => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      const input = document.getElementById('bci-quick-input');
      if (input) {
        input.value = transcript.trim();
        autoSizeInput(input);
      }
    };
    voiceRecognition.onerror = event => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        TT.Utils.toast('请允许麦克风权限后再试', 'error');
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        TT.Utils.toast('没有识别成功，请再说一次', 'error');
      }
    };
    voiceRecognition.onend = () => {
      setVoiceListeningState(false, '识别完成，可修改后保存');
      voiceRecognition = null;
    };

    try {
      voiceRecognition.start();
    } catch (error) {
      voiceRecognition = null;
      setVoiceListeningState(false);
      TT.Utils.toast('语音输入暂时无法启动，请稍后再试', 'error');
    }
  }

  function setVoiceListeningState(listening, message) {
    isVoiceListening = listening;
    const button = document.getElementById('bci-voice-btn');
    const status = document.getElementById('bci-voice-status');
    if (!button || !status) return;
    button.classList.toggle('listening', listening);
    button.setAttribute('aria-pressed', String(listening));
    button.setAttribute('aria-label', listening ? '停止语音输入' : '开始语音输入');
    status.textContent = message || '按下麦克风开始说，或直接输入文字';
    status.classList.toggle('listening', listening);
  }

  function getVisibleItems() {
    let items = TT.Store.getCollection('bci').slice();
    if (currentFilter !== 'all') items = items.filter(item => item.kind === currentFilter);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => (item.content || '').toLowerCase().includes(query));
    }
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function renderList() {
    const list = document.getElementById('bci-list');
    if (!list) return;
    const items = getVisibleItems();

    if (!items.length) {
      const filtered = currentFilter !== 'all' || searchQuery;
      list.innerHTML = `
        <div class="thoughts-empty bci-empty">
          <div class="empty-state-icon">${TT.Utils.icons.brain}</div>
          <div class="thoughts-empty-title">${filtered ? '没有找到匹配的 BCI 内容' : '还没有 BCI 记录'}</div>
          <div class="empty-state-text">${filtered ? '试试其他关键词或切换分类' : '先记下一个知识点或问题吧'}</div>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map(item => {
      const normalizedKind = KINDS[item.kind] ? item.kind : 'basics';
      const kind = KINDS[normalizedKind];
      return `
        <article class="thought-card bci-card bci-card-${normalizedKind}" data-bci-id="${item.id}">
          <div class="thought-card-topline">
            <span class="thought-kind-badge">${TT.Utils.icons[kind.icon]} ${kind.label}</span>
            <time>${TT.Utils.formatDate(item.createdAt, 'datetime')}</time>
          </div>
          <div class="thought-card-content">${TT.Utils.escapeHtml(item.content || '')}</div>
          <div class="thought-card-actions">
            <button class="task-action-btn" type="button" data-bci-edit="${item.id}" aria-label="编辑这条 BCI 记录">${TT.Utils.icons.edit}</button>
            <button class="task-action-btn delete" type="button" data-bci-delete="${item.id}" aria-label="删除这条 BCI 记录">${TT.Utils.icons.trash}</button>
          </div>
        </article>
      `;
    }).join('');

    list.querySelectorAll('[data-bci-id]').forEach(card => {
      card.onclick = event => {
        if (!event.target.closest('button')) openEditor(card.dataset.bciId);
      };
    });
    list.querySelectorAll('[data-bci-edit]').forEach(button => {
      button.onclick = () => openEditor(button.dataset.bciEdit);
    });
    list.querySelectorAll('[data-bci-delete]').forEach(button => {
      button.onclick = () => deleteItem(button.dataset.bciDelete);
    });
  }

  function openEditor(id) {
    const item = id ? TT.Store.getCollection('bci').find(entry => entry.id === id) : null;
    const selectedKind = item?.kind || captureKind;
    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">分类</label>
        <div class="thoughts-kind-switch thoughts-modal-kind bci-kind-switch bci-modal-kind" role="group" aria-label="BCI 内容类型">
          ${renderKindButtons('editor', selectedKind)}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="bci-editor-content">内容</label>
        <textarea class="form-textarea" id="bci-editor-content" maxlength="5000" style="min-height:190px;" placeholder="记下与 BCI 有关的内容…">${item ? TT.Utils.escapeHtml(item.content || '') : ''}</textarea>
      </div>
    `;

    let editorKind = selectedKind;
    body.querySelectorAll('[data-bci-kind-context="editor"]').forEach(button => {
      button.onclick = () => {
        editorKind = button.dataset.bciKind;
        body.querySelectorAll('[data-bci-kind-context="editor"]').forEach(candidate => {
          const active = candidate.dataset.bciKind === editorKind;
          candidate.classList.toggle('active', active);
          candidate.setAttribute('aria-pressed', String(active));
        });
      };
    });

    const modal = TT.Utils.modal({ title: item ? '编辑 BCI 记录' : '新增 BCI 记录', body, footer: false });
    const footer = TT.Utils.createEl('div', { class: 'modal-footer' });
    footer.style.justifyContent = 'flex-end';
    footer.appendChild(TT.Utils.createEl('button', { class: 'btn', text: '取消', onclick: () => modal.close() }));
    footer.appendChild(TT.Utils.createEl('button', {
      class: 'btn btn-primary',
      text: '保存',
      onclick: () => {
        const content = document.getElementById('bci-editor-content').value.trim();
        if (!content) {
          TT.Utils.toast('请输入 BCI 内容', 'error');
          return;
        }
        if (item) {
          TT.Store.updateItem('bci', id, { kind: editorKind, content });
          TT.Utils.toast('BCI 记录已更新');
        } else {
          TT.Store.addItem('bci', { kind: editorKind, content });
          TT.Utils.toast('BCI 记录已保存');
        }
        modal.close();
        renderList();
      }
    }));
    modal.el.appendChild(footer);
    setTimeout(() => document.getElementById('bci-editor-content')?.focus(), 80);
  }

  async function deleteItem(id) {
    const ok = await TT.Utils.confirm({ title: '删除 BCI 记录', text: '这条内容将被永久删除。' });
    if (!ok) return;
    TT.Store.removeItem('bci', id);
    TT.Utils.toast('已删除');
    renderList();
  }

  function cleanup() {
    if (voiceRecognition) {
      voiceRecognition.abort();
      voiceRecognition = null;
    }
    isVoiceListening = false;
  }

  return { render, cleanup };
})();
