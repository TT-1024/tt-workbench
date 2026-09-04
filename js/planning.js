/* ============================================
   TT工作台 - Planning Module
   每日待办 / 周待办 / 长期目标 / 习惯打卡
   ============================================ */

window.TT = window.TT || {};

TT.Planning = (function() {
  const COMPLETED_TASK_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
  let voiceRecognition = null;
  let isVoiceListening = false;
  const QUADRANTS = [
    { id: 'urgent-focus', urgent: true, focus: true, title: '紧急 · 需要专注', subtitle: '现在优先，留出安静时间', tone: 'red' },
    { id: 'calm-focus', urgent: false, focus: true, title: '不紧急 · 需要专注', subtitle: '重要推进，安排深度时间', tone: 'purple' },
    { id: 'urgent-flex', urgent: true, focus: false, title: '紧急 · 随时可做', subtitle: '快速处理，尽快清空', tone: 'orange' },
    { id: 'calm-flex', urgent: false, focus: false, title: '不紧急 · 随时可做', subtitle: '弹性安排，有空顺手完成', tone: 'blue' }
  ];

  function render(container) {
    container.innerHTML = `
      <div class="page-container planning-page">
        <div class="page-header">
          <div class="page-title-group">
            <h1>计划</h1>
            <p class="page-subtitle">按紧急程度与专注环境安排任务，重要程度决定象限内顺序</p>
          </div>
          <button class="btn btn-primary planning-new-task-btn" id="planning-new-task-btn">${TT.Utils.icons.plus} 新建任务</button>
        </div>
        <div class="planning-quick-capture">
          <button class="planning-voice-btn" id="planning-voice-btn" type="button" aria-label="开始语音输入" aria-pressed="false">${TT.Utils.icons.mic}</button>
          <input class="planning-quick-input" id="planning-quick-input" type="text" placeholder="说出或输入一项任务…" maxlength="100" autocomplete="off" inputmode="text" x-webkit-speech speech>
          <button class="planning-send-btn" id="planning-send-btn" type="button" aria-label="添加任务">${TT.Utils.icons.arrowUp}</button>
          <div class="planning-voice-status" id="planning-voice-status">快速记录默认进入「紧急 · 随时可做」</div>
        </div>
        <div class="planning-board" id="planning-board"></div>
        <div class="planning-support-grid" id="planning-support-grid"></div>
      </div>
    `;
    renderGrid();
    setupQuickCapture();
  }

  function setupQuickCapture() {
    const input = document.getElementById('planning-quick-input');
    const sendButton = document.getElementById('planning-send-btn');
    const voiceButton = document.getElementById('planning-voice-btn');

    sendButton.onclick = addQuickTask;
    input.onkeydown = event => {
      if (event.key === 'Enter' && !event.isComposing) addQuickTask();
    };
    voiceButton.onclick = toggleVoiceInput;
  }

  function addQuickTask() {
    const input = document.getElementById('planning-quick-input');
    const title = input.value.trim();
    if (!title) {
      TT.Utils.toast('请先说出或输入任务', 'error');
      input.focus();
      return;
    }

    TT.Store.addItem('tasks.daily', {
      title,
      date: '',
      urgent: true,
      focus: false,
      importance: 2,
      completed: false
    });
    input.value = '';
    TT.Utils.toast('任务已加入「紧急 · 随时可做」');
    renderGrid();
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
      const input = document.getElementById('planning-quick-input');
      if (input) input.focus();
      return;
    }

    voiceRecognition = new SpeechRecognition();
    voiceRecognition.lang = 'zh-CN';
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = true;

    voiceRecognition.onstart = () => setVoiceListeningState(true, '正在听，请说出任务…');
    voiceRecognition.onresult = event => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const input = document.getElementById('planning-quick-input');
      if (input) input.value = transcript.trim();
    };
    voiceRecognition.onerror = event => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        TT.Utils.toast('请允许麦克风权限后再试', 'error');
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        TT.Utils.toast('没有识别成功，请再说一次', 'error');
      }
    };
    voiceRecognition.onend = () => {
      setVoiceListeningState(false, '识别完成，可修改后发送');
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
    const button = document.getElementById('planning-voice-btn');
    const status = document.getElementById('planning-voice-status');
    if (!button || !status) return;

    button.classList.toggle('listening', listening);
    button.setAttribute('aria-pressed', String(listening));
    button.setAttribute('aria-label', listening ? '停止语音输入' : '开始语音输入');
    status.textContent = message || '快速记录默认进入「紧急 · 随时可做」';
    status.classList.toggle('listening', listening);
  }

  function renderGrid() {
    cleanupCompletedTasks();
    renderBoard();

    const supportGrid = document.getElementById('planning-support-grid');
    supportGrid.innerHTML = '';
    supportGrid.appendChild(renderLongtermCard());
    supportGrid.appendChild(renderHabitsCard());

    document.getElementById('planning-new-task-btn').onclick = () => openTaskEditor();
  }

  function cleanupCompletedTasks() {
    const now = Date.now();

    ['tasks.daily', 'tasks.weekly'].forEach(path => {
      const tasks = TT.Store.getCollection(path);
      let changed = false;

      const remaining = tasks.filter(task => {
        if (!task.completed) return true;

        const completedAt = Date.parse(task.completedAt || '');
        if (!Number.isFinite(completedAt)) {
          task.completedAt = new Date(now).toISOString();
          changed = true;
          return true;
        }

        if (now - completedAt > COMPLETED_TASK_RETENTION_MS) {
          changed = true;
          return false;
        }

        return true;
      });

      if (changed) TT.Store.setCollection(path, remaining);
    });
  }

  function getBoardTasks() {
    return ['tasks.daily', 'tasks.weekly'].flatMap(path =>
      TT.Store.getCollection(path).map(task => ({
        ...task,
        _path: path,
        urgent: typeof task.urgent === 'boolean' ? task.urgent : path === 'tasks.daily',
        focus: typeof task.focus === 'boolean' ? task.focus : false,
        importance: Number(task.importance) || 2
      }))
    );
  }

  function renderBoard() {
    const board = document.getElementById('planning-board');
    const tasks = getBoardTasks();

    board.innerHTML = QUADRANTS.map((quadrant, index) => {
      const quadrantTasks = tasks
        .filter(task => task.urgent === quadrant.urgent && task.focus === quadrant.focus)
        .sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          if (a.importance !== b.importance) return b.importance - a.importance;
          return (a.date || '9999') > (b.date || '9999') ? 1 : -1;
        });

      return `
        <section class="planning-quadrant planning-quadrant-${quadrant.tone} stagger-item" style="animation-delay:${index * 0.04}s">
          <div class="planning-quadrant-header">
            <div>
              <div class="planning-quadrant-title">${TT.Utils.escapeHtml(quadrant.title)} <span>${quadrantTasks.length}</span></div>
              <div class="planning-quadrant-subtitle">${TT.Utils.escapeHtml(quadrant.subtitle)}</div>
            </div>
            <button class="card-add-btn" data-add-quadrant="${quadrant.id}" aria-label="添加到${TT.Utils.escapeHtml(quadrant.title)}">${TT.Utils.icons.plus}</button>
          </div>
          <div class="planning-quadrant-body" data-quadrant-drop="${quadrant.id}">
            ${renderTaskCards(quadrantTasks)}
          </div>
        </section>
      `;
    }).join('');

    board.querySelectorAll('[data-add-quadrant]').forEach(button => {
      button.onclick = () => {
        const quadrant = QUADRANTS.find(item => item.id === button.dataset.addQuadrant);
        openTaskEditor(null, null, quadrant);
      };
    });

    board.querySelectorAll('.planning-task-card').forEach(card => {
      card.addEventListener('dragstart', event => {
        card.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify({ path: card.dataset.path, id: card.dataset.id }));
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        board.querySelectorAll('[data-quadrant-drop]').forEach(zone => zone.classList.remove('drag-over'));
      });
    });

    board.querySelectorAll('[data-quadrant-drop]').forEach(zone => {
      zone.addEventListener('dragover', event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', event => {
        event.preventDefault();
        zone.classList.remove('drag-over');
        try {
          const source = JSON.parse(event.dataTransfer.getData('text/plain'));
          const quadrant = QUADRANTS.find(item => item.id === zone.dataset.quadrantDrop);
          if (quadrant) moveTaskToQuadrant(source.path, source.id, quadrant);
        } catch (error) {
          console.warn('Unable to move task card', error);
        }
      });
    });
  }

  function moveTaskToQuadrant(path, id, quadrant) {
    const targetPath = quadrant.urgent ? 'tasks.daily' : 'tasks.weekly';
    saveTaskToPath(path, targetPath, id, { urgent: quadrant.urgent, focus: quadrant.focus });
    renderGrid();
  }

  function saveTaskToPath(sourcePath, targetPath, id, updates) {
    const sourceTasks = TT.Store.getCollection(sourcePath);
    const task = sourceTasks.find(item => item.id === id);
    if (!task) return false;

    if (targetPath === sourcePath) {
      TT.Store.updateItem(sourcePath, id, updates);
      return true;
    }

    const movedTask = { ...task, ...updates, updatedAt: new Date().toISOString() };
    TT.Store.setCollection(sourcePath, sourceTasks.filter(item => item.id !== id));
    TT.Store.setCollection(targetPath, [...TT.Store.getCollection(targetPath), movedTask]);
    return true;
  }

  function renderTaskCards(tasks) {
    if (tasks.length === 0) return `<div class="planning-empty-card">暂无任务，点击右上角＋添加</div>`;

    return tasks.map((task, i) => {
      const importance = Math.max(1, Math.min(3, task.importance));
      const importanceLabel = ['', '低重要', '中重要', '高重要'][importance];
      return `
        <article class="planning-task-card importance-${importance} ${task.completed ? 'completed' : ''}" style="animation-delay:${i * 0.025}s" data-path="${task._path}" data-id="${task.id}" draggable="true" onclick="TT.Planning.toggleTask('${task._path}','${task.id}')">
          <div class="planning-task-main">
            <div class="task-checkbox ${task.completed ? 'checked' : ''}">${TT.Utils.icons.check}</div>
            <div class="planning-task-copy">
              <div class="task-title">${TT.Utils.escapeHtml(task.title)}</div>
              <div class="planning-task-meta">
                <span class="importance-badge importance-${importance}">${TT.Utils.icons.star} ${importanceLabel}</span>
                ${task.date ? `<span class="task-date ${TT.Utils.isOverdue(task.date) && !task.completed ? 'overdue' : ''}">${TT.Utils.icons.clock} ${TT.Utils.relativeDate(task.date)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="task-actions">
            <button class="task-action-btn" onclick="event.stopPropagation();TT.Planning.editTask('${task._path}','${task.id}')" aria-label="编辑任务">${TT.Utils.icons.edit}</button>
            <button class="task-action-btn delete" onclick="event.stopPropagation();TT.Planning.deleteTask('${task._path}','${task.id}')" aria-label="删除任务">${TT.Utils.icons.trash}</button>
          </div>
        </article>
      `;
    }).join('');
  }

  // ===== Long-term Goals =====
  function renderLongtermCard() {
    const goals = TT.Store.getCollection('tasks.longterm');

    const card = TT.Utils.createEl('div', {
      class: 'glass-card planning-card stagger-item',
      dataset: { type: 'longterm' },
      style: { animationDelay: '0.1s' }
    });

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">${TT.Utils.icons.award}</div>
          长期目标
        </div>
        <button class="card-add-btn" id="add-longterm-btn">${TT.Utils.icons.plus}</button>
      </div>
      <div class="card-body" id="longterm-list"></div>
    `;

    setTimeout(() => {
      renderGoalList('longterm-list', 'tasks.longterm', goals);
      document.getElementById('add-longterm-btn').onclick = () => openGoalEditor('tasks.longterm');
    }, 0);

    return card;
  }

  // ===== Habits =====
  function renderHabitsCard() {
    const habits = TT.Store.getCollection('tasks.habits');

    const card = TT.Utils.createEl('div', {
      class: 'glass-card planning-card stagger-item',
      dataset: { type: 'habits' },
      style: { animationDelay: '0.15s' }
    });

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">${TT.Utils.icons.flame}</div>
          长期坚持
        </div>
        <button class="card-add-btn" id="add-habit-btn">${TT.Utils.icons.plus}</button>
      </div>
      <div class="card-body" id="habits-list"></div>
    `;

    setTimeout(() => {
      renderHabitList('habits-list', 'tasks.habits', habits);
      document.getElementById('add-habit-btn').onclick = () => openHabitEditor('tasks.habits');
    }, 0);

    return card;
  }

  // ===== Render Goal List =====
  function renderGoalList(containerId, path, goals) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sorted = [...goals].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.date || '9999') > (b.date || '9999') ? 1 : -1;
    });

    if (sorted.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${TT.Utils.icons.award}</div>
          <div class="empty-state-text">暂无长期目标</div>
        </div>
      `;
      return;
    }

    container.innerHTML = sorted.map((goal, i) => {
      const progress = goal.progress || 0;
      const completed = progress >= 100;
      return `
        <div class="goal-item stagger-item" style="animation-delay:${i * 0.04}s" data-id="${goal.id}">
          <div class="goal-top">
            <div class="goal-name" style="${completed ? 'text-decoration:line-through;opacity:0.5;' : ''}">${TT.Utils.escapeHtml(goal.title)}</div>
            <div class="goal-date">${goal.date ? TT.Utils.formatDate(goal.date, 'short') : ''}</div>
            <div class="task-actions">
              <button class="task-action-btn" onclick="event.stopPropagation();TT.Planning.editGoal('${path}','${goal.id}')">${TT.Utils.icons.edit}</button>
              <button class="task-action-btn delete" onclick="event.stopPropagation();TT.Planning.deleteGoal('${path}','${goal.id}')">${TT.Utils.icons.trash}</button>
            </div>
          </div>
          ${goal.note ? `<div class="goal-note">${TT.Utils.escapeHtml(goal.note)}</div>` : ''}
          <div class="goal-progress">
            <input
              class="goal-progress-slider"
              type="range"
              min="0"
              max="100"
              step="5"
              value="${progress}"
              aria-label="${TT.Utils.escapeHtml(goal.title)}的完成进度"
              style="--goal-progress:${progress}%"
            >
            <div class="goal-progress-text">${progress}%</div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.goal-progress-slider').forEach(slider => {
      const item = slider.closest('.goal-item');
      const name = item.querySelector('.goal-name');
      const progressText = item.querySelector('.goal-progress-text');

      slider.addEventListener('input', () => {
        const progress = Number(slider.value);
        slider.style.setProperty('--goal-progress', `${progress}%`);
        progressText.textContent = `${progress}%`;
        name.style.textDecoration = progress >= 100 ? 'line-through' : '';
        name.style.opacity = progress >= 100 ? '0.5' : '';
      });

      slider.addEventListener('change', () => {
        const progress = Number(slider.value);
        TT.Store.updateItem(path, item.dataset.id, {
          progress,
          completed: progress >= 100
        });
      });
    });
  }

  // ===== Render Habit List =====
  function renderHabitList(containerId, path, habits) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (habits.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${TT.Utils.icons.flame}</div>
          <div class="empty-state-text">暂无习惯，开始坚持吧</div>
        </div>
      `;
      return;
    }

    const today = TT.Utils.todayStr();
    container.innerHTML = habits.map((habit, i) => {
      const streak = habit.streak || 0;
      const history = habit.history || [];
      const checkedToday = history.includes(today);
      const totalDays = Math.max(1, Math.ceil((new Date() - new Date(habit.createdAt)) / (1000 * 60 * 60 * 24)) + 1);
      const rate = Math.round((history.length / totalDays) * 100);

      return `
        <div class="habit-item stagger-item" style="animation-delay:${i * 0.04}s" data-id="${habit.id}">
          <div class="habit-top">
            <div class="habit-name">${TT.Utils.escapeHtml(habit.title)}</div>
            <div class="task-actions">
              <button class="task-action-btn" onclick="event.stopPropagation();TT.Planning.editHabit('${path}','${habit.id}')">${TT.Utils.icons.edit}</button>
              <button class="task-action-btn delete" onclick="event.stopPropagation();TT.Planning.deleteHabit('${path}','${habit.id}')">${TT.Utils.icons.trash}</button>
            </div>
          </div>
          <div class="habit-bottom">
            <div class="habit-streak">${TT.Utils.icons.flame} 连续 ${streak} 天</div>
            <div class="habit-rate">完成率 <strong>${rate}%</strong></div>
            <button class="habit-checkin-btn ${checkedToday ? 'done' : ''}" onclick="event.stopPropagation();TT.Planning.checkinHabit('${path}','${habit.id}')">
              ${checkedToday ? '✓ 已打卡' : '打卡'}
            </button>
          </div>
          <div class="habit-progress-bar">
            <div class="habit-progress-fill" style="width:${Math.min(rate, 100)}%;background:linear-gradient(90deg,#30d158,#64d2ff);"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ===== Task Editor =====
  function taskEditorContent(task, preset) {
    const urgent = task ? (typeof task.urgent === 'boolean' ? task.urgent : task._path === 'tasks.daily') : (preset ? preset.urgent : true);
    const focus = task ? Boolean(task.focus) : (preset ? preset.focus : true);
    const importance = task ? (Number(task.importance) || 2) : 2;
    return `
      <div class="form-group">
        <label class="form-label">任务名称</label>
        <input type="text" class="form-input" id="task-title" placeholder="要完成什么？" value="${task ? TT.Utils.escapeHtml(task.title) : ''}" maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">截止日期</label>
        <input type="date" class="form-input" id="task-date" value="${task ? (task.date || '') : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">是否紧急</label>
        <div class="planning-choice-row">
          <label class="planning-choice"><input type="radio" name="task-urgent" value="true" ${urgent ? 'checked' : ''}><span>紧急</span></label>
          <label class="planning-choice"><input type="radio" name="task-urgent" value="false" ${!urgent ? 'checked' : ''}><span>不紧急</span></label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">完成环境</label>
        <div class="planning-choice-row">
          <label class="planning-choice"><input type="radio" name="task-focus" value="true" ${focus ? 'checked' : ''}><span>需要安静专注</span></label>
          <label class="planning-choice"><input type="radio" name="task-focus" value="false" ${!focus ? 'checked' : ''}><span>随时可以做</span></label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">重要程度</label>
        <div class="planning-choice-row planning-importance-row">
          ${[1, 2, 3].map(level => `
            <label class="planning-choice importance-choice-${level}">
              <input type="radio" name="task-importance" value="${level}" ${importance === level ? 'checked' : ''}>
              <span>${TT.Utils.icons.star} ${['', '低', '中', '高'][level]}</span>
            </label>
          `).join('')}
        </div>
        <div class="form-hint">重要程度不会增加更多象限，只影响卡片标记与象限内排序。</div>
      </div>
    `;
  }

  function readTaskEditor() {
    return {
      title: document.getElementById('task-title').value.trim(),
      date: document.getElementById('task-date').value,
      urgent: document.querySelector('input[name="task-urgent"]:checked').value === 'true',
      focus: document.querySelector('input[name="task-focus"]:checked').value === 'true',
      importance: Number(document.querySelector('input[name="task-importance"]:checked').value)
    };
  }

  function openTaskEditor(path, type, preset) {
    const body = TT.Utils.createEl('div');
    body.innerHTML = taskEditorContent(null, preset);

    TT.Utils.modal({
      title: '新建任务',
      body: body,
      confirmText: '创建',
      onConfirm: () => {
        const data = readTaskEditor();
        if (!data.title) { TT.Utils.toast('请输入任务名称', 'error'); return false; }
        const targetPath = data.urgent ? 'tasks.daily' : 'tasks.weekly';
        TT.Store.addItem(targetPath, { ...data, completed: false });
        TT.Utils.toast('任务已创建');
        renderGrid();
      }
    });

    setTimeout(() => document.getElementById('task-title').focus(), 100);
  }

  function toggleTask(path, id) {
    const tasks = TT.Store.getCollection(path);
    const task = tasks.find(t => t.id === id);
    if (task) {
      const completed = !task.completed;
      TT.Store.updateItem(path, id, {
        completed,
        completedAt: completed ? new Date().toISOString() : null
      });
      renderGrid();
    }
  }

  function editTask(path, id) {
    const tasks = TT.Store.getCollection(path);
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task._path = path;

    const body = TT.Utils.createEl('div');
    body.innerHTML = taskEditorContent(task);

    TT.Utils.modal({
      title: '编辑任务',
      body: body,
      confirmText: '保存',
      onConfirm: () => {
        const data = readTaskEditor();
        if (!data.title) { TT.Utils.toast('请输入任务名称', 'error'); return false; }
        const targetPath = data.urgent ? 'tasks.daily' : 'tasks.weekly';
        saveTaskToPath(path, targetPath, id, data);
        TT.Utils.toast('已保存');
        renderGrid();
      }
    });
  }

  async function deleteTask(path, id) {
    const ok = await TT.Utils.confirm({ title: '删除任务', text: '此任务将被永久删除。' });
    if (ok) {
      TT.Store.removeItem(path, id);
      TT.Utils.toast('已删除');
      renderGrid();
    }
  }

  // ===== Goal Editor =====
  function openGoalEditor(path) {
    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">目标名称</label>
        <input type="text" class="form-input" id="goal-title" placeholder="输入长期目标" maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">目标日期</label>
        <input type="date" class="form-input" id="goal-date">
      </div>
      <div class="form-group">
        <label class="form-label">备注</label>
        <textarea class="form-textarea" id="goal-note" placeholder="补充说明..." maxlength="500"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">当前进度: <span id="progress-display">0</span>%</label>
        <input type="range" id="goal-progress" min="0" max="100" value="0" step="5" style="width:100%;accent-color:var(--accent-orange);">
      </div>
    `;

    const m = TT.Utils.modal({
      title: '新建长期目标',
      body: body,
      confirmText: '创建',
      onConfirm: () => {
        const title = document.getElementById('goal-title').value.trim();
        if (!title) { TT.Utils.toast('请输入目标名称', 'error'); return false; }
        const date = document.getElementById('goal-date').value;
        const note = document.getElementById('goal-note').value.trim();
        const progress = parseInt(document.getElementById('goal-progress').value) || 0;
        TT.Store.addItem(path, { title, date, note, progress, completed: progress >= 100 });
        TT.Utils.toast('目标已创建');
        renderGrid();
      }
    });

    const slider = m.el.querySelector('#goal-progress');
    const display = m.el.querySelector('#progress-display');
    slider.oninput = () => { display.textContent = slider.value; };
  }

  function editGoal(path, id) {
    const goals = TT.Store.getCollection(path);
    const goal = goals.find(g => g.id === id);
    if (!goal) return;

    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">目标名称</label>
        <input type="text" class="form-input" id="goal-title" value="${TT.Utils.escapeHtml(goal.title)}" maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">目标日期</label>
        <input type="date" class="form-input" id="goal-date" value="${goal.date || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">备注</label>
        <textarea class="form-textarea" id="goal-note" maxlength="500">${TT.Utils.escapeHtml(goal.note || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">当前进度: <span id="progress-display">${goal.progress || 0}</span>%</label>
        <input type="range" id="goal-progress" min="0" max="100" value="${goal.progress || 0}" step="5" style="width:100%;accent-color:var(--accent-orange);">
      </div>
    `;

    const m = TT.Utils.modal({
      title: '编辑长期目标',
      body: body,
      confirmText: '保存',
      onConfirm: () => {
        const title = document.getElementById('goal-title').value.trim();
        if (!title) { TT.Utils.toast('请输入目标名称', 'error'); return false; }
        const date = document.getElementById('goal-date').value;
        const note = document.getElementById('goal-note').value.trim();
        const progress = parseInt(document.getElementById('goal-progress').value) || 0;
        TT.Store.updateItem(path, id, { title, date, note, progress, completed: progress >= 100 });
        TT.Utils.toast('已保存');
        renderGrid();
      }
    });

    const slider = m.el.querySelector('#goal-progress');
    const display = m.el.querySelector('#progress-display');
    slider.oninput = () => { display.textContent = slider.value; };
  }

  async function deleteGoal(path, id) {
    const ok = await TT.Utils.confirm({ title: '删除目标', text: '此目标将被永久删除。' });
    if (ok) {
      TT.Store.removeItem(path, id);
      TT.Utils.toast('已删除');
      renderGrid();
    }
  }

  // ===== Habit Editor =====
  function openHabitEditor(path) {
    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">习惯名称</label>
        <input type="text" class="form-input" id="habit-title" placeholder="如：每日阅读、健身、学英语" maxlength="50">
      </div>
    `;

    TT.Utils.modal({
      title: '新建习惯',
      body: body,
      confirmText: '创建',
      onConfirm: () => {
        const title = document.getElementById('habit-title').value.trim();
        if (!title) { TT.Utils.toast('请输入习惯名称', 'error'); return false; }
        TT.Store.addItem(path, { title, streak: 0, history: [] });
        TT.Utils.toast('习惯已创建');
        renderGrid();
      }
    });

    setTimeout(() => document.getElementById('habit-title').focus(), 100);
  }

  function checkinHabit(path, id) {
    const habits = TT.Store.getCollection(path);
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const today = TT.Utils.todayStr();
    const history = habit.history || [];

    if (history.includes(today)) {
      // Undo today's check-in
      const newHistory = history.filter(d => d !== today);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = TT.Utils.formatDateInput(yesterday);

      let newStreak = 0;
      if (newHistory.includes(yesterdayStr)) {
        newStreak = calcStreak(newHistory, yesterdayStr);
      }
      TT.Store.updateItem(path, id, { history: newHistory, streak: newStreak });
      TT.Utils.toast('已取消打卡');
    } else {
      // Check in
      const newHistory = [...history, today];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = TT.Utils.formatDateInput(yesterday);

      let newStreak = 1;
      if (history.includes(yesterdayStr)) {
        newStreak = (habit.streak || 0) + 1;
      }
      TT.Store.updateItem(path, id, { history: newHistory, streak: newStreak });
      TT.Utils.toast(`打卡成功！连续 ${newStreak} 天`);
    }
    renderGrid();
  }

  function calcStreak(history, startDate) {
    let streak = 0;
    let current = new Date(startDate);
    while (true) {
      const dateStr = TT.Utils.formatDateInput(current);
      if (history.includes(dateStr)) {
        streak++;
        current.setDate(current.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function editHabit(path, id) {
    const habits = TT.Store.getCollection(path);
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">习惯名称</label>
        <input type="text" class="form-input" id="habit-title" value="${TT.Utils.escapeHtml(habit.title)}" maxlength="50">
      </div>
    `;

    TT.Utils.modal({
      title: '编辑习惯',
      body: body,
      confirmText: '保存',
      onConfirm: () => {
        const title = document.getElementById('habit-title').value.trim();
        if (!title) { TT.Utils.toast('请输入习惯名称', 'error'); return false; }
        TT.Store.updateItem(path, id, { title });
        TT.Utils.toast('已保存');
        renderGrid();
      }
    });
  }

  async function deleteHabit(path, id) {
    const ok = await TT.Utils.confirm({ title: '删除习惯', text: '此习惯及其打卡记录将被永久删除。' });
    if (ok) {
      TT.Store.removeItem(path, id);
      TT.Utils.toast('已删除');
      renderGrid();
    }
  }

  return {
    render,
    toggleTask,
    editTask,
    deleteTask,
    editGoal,
    deleteGoal,
    checkinHabit,
    editHabit,
    deleteHabit
  };
})();
