/* ============================================
   TT工作台 - Thoughts Module (闪念)
   ============================================ */

window.TT = window.TT || {};

TT.Thoughts = (function() {
  let searchQuery = '';
  let currentFilter = 'all';
  let captureKind = 'insight';
  let voiceRecognition = null;
  let isVoiceListening = false;

  const KINDS = {
    insight: { label: '感悟', icon: 'sparkles', prompt: '说出或输入一个刚刚冒出的感悟…' },
    question: { label: '疑问', icon: 'chat', prompt: '说出或输入一个突然想到的问题…' }
  };

  function render(container) {
    container.innerHTML = `
      <div class="page-container thoughts-page">
        <div class="page-header">
          <div class="page-title-group">
            <h1>闪念</h1>
            <p class="page-subtitle">收下突然冒出的感悟与疑问，别让它们溜走</p>
          </div>
          <button class="btn btn-primary thoughts-new-btn" id="thoughts-new-btn">${TT.Utils.icons.plus} 记一条</button>
        </div>

        <section class="thoughts-capture" aria-label="快速记录闪念">
          <div class="thoughts-kind-switch" role="group" aria-label="记录类型">
            ${renderKindButtons('capture')}
          </div>
          <div class="thoughts-capture-row">
            <button class="thoughts-voice-btn" id="thoughts-voice-btn" type="button" aria-label="开始语音输入" aria-pressed="false">${TT.Utils.icons.mic}</button>
            <textarea class="thoughts-quick-input" id="thoughts-quick-input" rows="1" maxlength="5000" placeholder="${KINDS[captureKind].prompt}" autocomplete="off" inputmode="text" x-webkit-speech speech></textarea>
            <button class="thoughts-send-btn" id="thoughts-send-btn" type="button" aria-label="保存闪念">${TT.Utils.icons.arrowUp}</button>
          </div>
          <div class="thoughts-voice-status" id="thoughts-voice-status">按下麦克风开始说，或直接输入文字</div>
        </section>

        <div class="thoughts-toolbar">
          <div class="search-box thoughts-search-box">
            ${TT.Utils.icons.search}
            <input type="text" id="thoughts-search" placeholder="搜索闪念...">
          </div>
          <div class="thoughts-filter" role="group" aria-label="筛选闪念">
            <button class="thoughts-filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">全部</button>
            <button class="thoughts-filter-btn ${currentFilter === 'insight' ? 'active' : ''}" data-filter="insight">感悟</button>
            <button class="thoughts-filter-btn ${currentFilter === 'question' ? 'active' : ''}" data-filter="question">疑问</button>
          </div>
        </div>

        <div class="thoughts-list" id="thoughts-list"></div>
      </div>
    `;

    setupCapture();
    setupToolbar(container);
    document.getElementById('thoughts-new-btn').onclick = () => openEditor();
    renderList();
  }

  function renderKindButtons(context, selectedKind) {
    const selected = selectedKind || captureKind;
    return Object.entries(KINDS).map(([kind, config]) => `
      <button type="button" class="thoughts-kind-btn ${selected === kind ? 'active' : ''}" data-kind="${kind}" data-kind-context="${context}" aria-pressed="${selected === kind}">
        ${TT.Utils.icons[config.icon]} ${config.label}
      </button>
    `).join('');
  }

  function setupCapture() {
    const input = document.getElementById('thoughts-quick-input');
    const sendButton = document.getElementById('thoughts-send-btn');
    const voiceButton = document.getElementById('thoughts-voice-btn');

    document.querySelectorAll('[data-kind-context="capture"]').forEach(button => {
      button.onclick = () => {
        captureKind = button.dataset.kind;
        document.querySelectorAll('[data-kind-context="capture"]').forEach(candidate => {
          const active = candidate.dataset.kind === captureKind;
          candidate.classList.toggle('active', active);
          candidate.setAttribute('aria-pressed', String(active));
        });
        input.placeholder = KINDS[captureKind].prompt;
        input.focus();
      };
    });

    sendButton.onclick = addQuickThought;
    input.oninput = () => autoSizeInput(input);
    input.onkeydown = event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        addQuickThought();
      }
    };
    voiceButton.onclick = toggleVoiceInput;
  }

  function setupToolbar(container) {
    const searchInput = document.getElementById('thoughts-search');
    searchInput.value = searchQuery;
    searchInput.oninput = TT.Utils.debounce(() => {
      searchQuery = searchInput.value.trim();
      renderList();
    }, 180);

    container.querySelectorAll('[data-filter]').forEach(button => {
      button.onclick = () => {
        currentFilter = button.dataset.filter;
        container.querySelectorAll('[data-filter]').forEach(candidate => {
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

  function addQuickThought() {
    const input = document.getElementById('thoughts-quick-input');
    const content = input.value.trim();
    if (!content) {
      TT.Utils.toast('请先说出或输入一条闪念', 'error');
      input.focus();
      return;
    }

    TT.Store.addItem('thoughts', { kind: captureKind, content });
    input.value = '';
    autoSizeInput(input);
    TT.Utils.toast(`已记下这条${KINDS[captureKind].label}`);
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
      const input = document.getElementById('thoughts-quick-input');
      if (input) input.focus();
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
      const input = document.getElementById('thoughts-quick-input');
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
    const button = document.getElementById('thoughts-voice-btn');
    const status = document.getElementById('thoughts-voice-status');
    if (!button || !status) return;

    button.classList.toggle('listening', listening);
    button.setAttribute('aria-pressed', String(listening));
    button.setAttribute('aria-label', listening ? '停止语音输入' : '开始语音输入');
    status.textContent = message || '按下麦克风开始说，或直接输入文字';
    status.classList.toggle('listening', listening);
  }

  function getVisibleItems() {
    let items = TT.Store.getCollection('thoughts').slice();
    if (currentFilter !== 'all') items = items.filter(item => item.kind === currentFilter);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => (item.content || '').toLowerCase().includes(query));
    }
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function renderList() {
    const list = document.getElementById('thoughts-list');
    if (!list) return;
    const items = getVisibleItems();

    if (!items.length) {
      const filtered = currentFilter !== 'all' || searchQuery;
      list.innerHTML = `
        <div class="thoughts-empty">
          <div class="empty-state-icon">${TT.Utils.icons.sparkles}</div>
          <div class="thoughts-empty-title">${filtered ? '没有找到匹配的闪念' : '还没有闪念'}</div>
          <div class="empty-state-text">${filtered ? '试试其他关键词或切换类型' : '冒出想法时，说一句就能记下来'}</div>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map(item => {
      const normalizedKind = KINDS[item.kind] ? item.kind : 'insight';
      const kind = KINDS[normalizedKind];
      return `
        <article class="thought-card thought-card-${normalizedKind}" data-thought-id="${item.id}">
          <div class="thought-card-topline">
            <span class="thought-kind-badge">${TT.Utils.icons[kind.icon]} ${kind.label}</span>
            <time>${TT.Utils.formatDate(item.createdAt, 'datetime')}</time>
          </div>
          <div class="thought-card-content">${TT.Utils.escapeHtml(item.content || '')}</div>
          <div class="thought-card-actions">
            <button class="task-action-btn" type="button" data-thought-edit="${item.id}" aria-label="编辑这条闪念">${TT.Utils.icons.edit}</button>
            <button class="task-action-btn delete" type="button" data-thought-delete="${item.id}" aria-label="删除这条闪念">${TT.Utils.icons.trash}</button>
          </div>
        </article>
      `;
    }).join('');

    list.querySelectorAll('[data-thought-id]').forEach(card => {
      card.onclick = event => {
        if (!event.target.closest('button')) openEditor(card.dataset.thoughtId);
      };
    });
    list.querySelectorAll('[data-thought-edit]').forEach(button => {
      button.onclick = () => openEditor(button.dataset.thoughtEdit);
    });
    list.querySelectorAll('[data-thought-delete]').forEach(button => {
      button.onclick = () => deleteItem(button.dataset.thoughtDelete);
    });
  }

  function openEditor(id) {
    const item = id ? TT.Store.getCollection('thoughts').find(entry => entry.id === id) : null;
    const selectedKind = item?.kind || captureKind;
    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">类型</label>
        <div class="thoughts-kind-switch thoughts-modal-kind" role="group" aria-label="记录类型">
          ${renderKindButtons('editor', selectedKind)}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="thought-editor-content">内容</label>
        <textarea class="form-textarea" id="thought-editor-content" maxlength="5000" style="min-height:190px;" placeholder="记下这一刻在想什么…">${item ? TT.Utils.escapeHtml(item.content || '') : ''}</textarea>
      </div>
    `;

    let editorKind = selectedKind;
    body.querySelectorAll('[data-kind-context="editor"]').forEach(button => {
      button.onclick = () => {
        editorKind = button.dataset.kind;
        body.querySelectorAll('[data-kind-context="editor"]').forEach(candidate => {
          const active = candidate.dataset.kind === editorKind;
          candidate.classList.toggle('active', active);
          candidate.setAttribute('aria-pressed', String(active));
        });
      };
    });

    const modal = TT.Utils.modal({ title: item ? '编辑闪念' : '记一条闪念', body, footer: false });
    const footer = TT.Utils.createEl('div', { class: 'modal-footer' });
    footer.style.justifyContent = 'flex-end';
    footer.appendChild(TT.Utils.createEl('button', { class: 'btn', text: '取消', onclick: () => modal.close() }));
    footer.appendChild(TT.Utils.createEl('button', {
      class: 'btn btn-primary',
      text: '保存',
      onclick: () => {
        const content = document.getElementById('thought-editor-content').value.trim();
        if (!content) {
          TT.Utils.toast('请输入闪念内容', 'error');
          return;
        }
        if (item) {
          TT.Store.updateItem('thoughts', id, { kind: editorKind, content });
          TT.Utils.toast('闪念已更新');
        } else {
          TT.Store.addItem('thoughts', { kind: editorKind, content });
          TT.Utils.toast('闪念已记下');
        }
        modal.close();
        renderList();
      }
    }));
    modal.el.appendChild(footer);
    setTimeout(() => document.getElementById('thought-editor-content')?.focus(), 80);
  }

  async function deleteItem(id) {
    const ok = await TT.Utils.confirm({ title: '删除闪念', text: '这条闪念将被永久删除。' });
    if (!ok) return;
    TT.Store.removeItem('thoughts', id);
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
