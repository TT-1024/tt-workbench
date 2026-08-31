/* ============================================
   TT工作台 - Planning Module
   每日待办 / 周待办 / 长期目标 / 习惯打卡
   ============================================ */

window.TT = window.TT || {};

TT.Planning = (function() {
  const COMPLETED_TASK_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

  function render(container) {
    container.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <div class="page-title-group">
            <h1>计划</h1>
            <p class="page-subtitle">管理你的每日、每周、长期目标与习惯</p>
          </div>
        </div>
        <div class="planning-grid" id="planning-grid"></div>
      </div>
    `;
    renderGrid();
  }

  function renderGrid() {
    const grid = document.getElementById('planning-grid');
    cleanupCompletedTasks();
    grid.innerHTML = '';

    grid.appendChild(renderDailyCard());
    grid.appendChild(renderWeeklyCard());
    grid.appendChild(renderLongtermCard());
    grid.appendChild(renderHabitsCard());
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

  // ===== Daily Tasks =====
  function renderDailyCard() {
    const tasks = TT.Store.getCollection('tasks.daily');

    const card = TT.Utils.createEl('div', {
      class: 'glass-card planning-card stagger-item',
      dataset: { type: 'daily' },
      style: { animationDelay: '0s' }
    });

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">${TT.Utils.icons.calendar}</div>
          每日待办
        </div>
        <button class="card-add-btn" id="add-daily-btn">${TT.Utils.icons.plus}</button>
      </div>
      <div class="card-body" id="daily-list"></div>
    `;

    setTimeout(() => {
      renderTaskList('daily-list', 'tasks.daily', tasks);
      document.getElementById('add-daily-btn').onclick = () => openTaskEditor('tasks.daily', 'daily');
    }, 0);

    return card;
  }

  // ===== Weekly Tasks =====
  function renderWeeklyCard() {
    const tasks = TT.Store.getCollection('tasks.weekly');

    const card = TT.Utils.createEl('div', {
      class: 'glass-card planning-card stagger-item',
      dataset: { type: 'weekly' },
      style: { animationDelay: '0.05s' }
    });

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-icon">${TT.Utils.icons.target}</div>
          周待办
        </div>
        <button class="card-add-btn" id="add-weekly-btn">${TT.Utils.icons.plus}</button>
      </div>
      <div class="card-body" id="weekly-list"></div>
    `;

    setTimeout(() => {
      renderTaskList('weekly-list', 'tasks.weekly', tasks);
      document.getElementById('add-weekly-btn').onclick = () => openTaskEditor('tasks.weekly', 'weekly');
    }, 0);

    return card;
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

  // ===== Render Task List =====
  function renderTaskList(containerId, path, tasks) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sorted = [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.date || '9999') > (b.date || '9999') ? 1 : -1;
    });

    if (sorted.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${TT.Utils.icons.check}</div>
          <div class="empty-state-text">暂无任务，点击 + 添加</div>
        </div>
      `;
      return;
    }

    container.innerHTML = sorted.map((task, i) => `
      <div class="task-item ${task.completed ? 'completed' : ''} stagger-item" style="animation-delay:${i * 0.03}s" data-id="${task.id}" onclick="TT.Planning.toggleTask('${path}','${task.id}')">
        <div class="task-checkbox ${task.completed ? 'checked' : ''}">
          ${TT.Utils.icons.check}
        </div>
        <div class="task-content">
          <div class="task-title">${TT.Utils.escapeHtml(task.title)}</div>
          ${task.date ? `<div class="task-meta"><span class="task-date ${TT.Utils.isOverdue(task.date) && !task.completed ? 'overdue' : ''}">
            ${TT.Utils.icons.clock} ${TT.Utils.relativeDate(task.date)}
          </span></div>` : ''}
        </div>
        <div class="task-actions">
          <button class="task-action-btn" onclick="event.stopPropagation();TT.Planning.editTask('${path}','${task.id}')">${TT.Utils.icons.edit}</button>
          <button class="task-action-btn delete" onclick="event.stopPropagation();TT.Planning.deleteTask('${path}','${task.id}')">${TT.Utils.icons.trash}</button>
        </div>
      </div>
    `).join('');
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
  function openTaskEditor(path, type) {
    const isDaily = type === 'daily';
    const defaultDate = isDaily ? TT.Utils.todayStr() : '';

    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">任务名称</label>
        <input type="text" class="form-input" id="task-title" placeholder="输入任务名称" maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">截止日期</label>
        <input type="date" class="form-input" id="task-date" value="${defaultDate}">
      </div>
    `;

    TT.Utils.modal({
      title: '新建任务',
      body: body,
      confirmText: '创建',
      onConfirm: () => {
        const title = document.getElementById('task-title').value.trim();
        if (!title) { TT.Utils.toast('请输入任务名称', 'error'); return false; }
        const date = document.getElementById('task-date').value;
        TT.Store.addItem(path, { title, date, completed: false });
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

    const body = TT.Utils.createEl('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">任务名称</label>
        <input type="text" class="form-input" id="task-title" value="${TT.Utils.escapeHtml(task.title)}" maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">截止日期</label>
        <input type="date" class="form-input" id="task-date" value="${task.date || ''}">
      </div>
    `;

    TT.Utils.modal({
      title: '编辑任务',
      body: body,
      confirmText: '保存',
      onConfirm: () => {
        const title = document.getElementById('task-title').value.trim();
        if (!title) { TT.Utils.toast('请输入任务名称', 'error'); return false; }
        const date = document.getElementById('task-date').value;
        TT.Store.updateItem(path, id, { title, date });
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
