/* ============================================
   TT工作台 - Utilities & UI Components
   ============================================ */

window.TT = window.TT || {};

TT.Utils = (function() {

  // ===== ID Generation =====
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  // ===== DOM Helpers =====
  function $(selector, parent) {
    return (parent || document).querySelector(selector);
  }

  function $$(selector, parent) {
    return Array.from((parent || document).querySelectorAll(selector));
  }

  function createEl(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const key in attrs) {
        if (key === 'class') {
          el.className = attrs[key];
        } else if (key === 'html') {
          el.innerHTML = attrs[key];
        } else if (key === 'text') {
          el.textContent = attrs[key];
        } else if (key === 'dataset') {
          for (const dk in attrs.dataset) {
            el.dataset[dk] = attrs.dataset[dk];
          }
        } else if (key.startsWith('on') && typeof attrs[key] === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
        } else if (key === 'style' && typeof attrs[key] === 'object') {
          Object.assign(el.style, attrs[key]);
        } else {
          el.setAttribute(key, attrs[key]);
        }
      }
    }
    if (children) {
      if (typeof children === 'string') {
        el.innerHTML = children;
      } else if (Array.isArray(children)) {
        children.forEach(c => {
          if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
      } else if (typeof children === 'object') {
        el.appendChild(children);
      }
    }
    return el;
  }

  // ===== Date Formatting =====
  function formatDate(date, format) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d)) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');

    if (format === 'short') return `${mm}/${dd}`;
    if (format === 'time') return `${hh}:${min}`;
    if (format === 'datetime') return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
    return `${yyyy}/${mm}/${dd}`;
  }

  function formatDateInput(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d)) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function todayStr() {
    return formatDateInput(new Date());
  }

  function isToday(dateStr) {
    return dateStr === todayStr();
  }

  function isOverdue(dateStr) {
    if (!dateStr) return false;
    return dateStr < todayStr();
  }

  function relativeDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === -1) return '昨天';
    if (diff > 0 && diff <= 7) return `${diff}天后`;
    if (diff < 0) return `逾期${Math.abs(diff)}天`;
    return formatDate(dateStr);
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 6) return 'TT的工作台';
    if (h < 12) return 'Good Morning';
    if (h < 14) return 'Good Noon';
    if (h < 18) return 'Good Afternoon';
    if (h < 22) return 'Good Evening';
    return 'TT的工作台';
  }

  function getWeekRange() {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday };
  }

  function isThisWeek(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const { start, end } = getWeekRange();
    return d >= start && d <= end;
  }

  // ===== Escape HTML =====
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== Icons (SVG strings) =====
  const icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>',
    utensils: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"/><path d="M21 15v7"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
    plane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
    flask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    starOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    coffee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
    trending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
    drag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    lightbulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
  };

  function icon(name, size) {
    const s = size ? `width="${size}" height="${size}"` : '';
    const svg = icons[name] || icons.folder;
    return svg.replace('<svg', `<svg ${s}`);
  }

  // ===== Toast =====
  function toast(message, type) {
    type = type || 'success';
    const container = document.getElementById('toast-container');
    const iconName = type === 'success' ? 'check' : (type === 'error' ? 'alert' : 'alert');
    const toastEl = createEl('div', {
      class: `toast toast-${type}`,
      html: `<div class="toast-icon">${icons[iconName]}</div><span>${escapeHtml(message)}</span>`
    });
    container.appendChild(toastEl);
    setTimeout(() => {
      toastEl.classList.add('toast-out');
      setTimeout(() => toastEl.remove(), 300);
    }, 2500);
  }

  // ===== Modal =====
  function modal(options) {
    const container = document.getElementById('modal-container');

    const backdrop = createEl('div', { class: 'modal-backdrop' });

    const modalEl = createEl('div', {
      class: `modal ${options.size === 'lg' ? 'modal-lg' : options.size === 'sm' ? 'modal-sm' : ''}`
    });

    // Header
    const header = createEl('div', {
      class: 'modal-header',
      html: `<h3 class="modal-title">${escapeHtml(options.title || '')}</h3>`
    });
    const closeBtn = createEl('button', {
      class: 'modal-close',
      html: icons.close,
      onclick: closeModal
    });
    header.appendChild(closeBtn);
    modalEl.appendChild(header);

    // Body
    if (options.body) {
      const body = createEl('div', { class: 'modal-body' });
      if (typeof options.body === 'string') {
        body.innerHTML = options.body;
      } else {
        body.appendChild(options.body);
      }
      modalEl.appendChild(body);
    }

    // Footer
    if (options.footer !== false) {
      const footer = createEl('div', { class: 'modal-footer' });
      if (options.cancelText !== false) {
        footer.appendChild(createEl('button', {
          class: 'btn',
          text: options.cancelText || '取消',
          onclick: closeModal
        }));
      }
      if (options.confirmText !== false) {
        const confirmBtn = createEl('button', {
          class: `btn ${options.confirmClass || 'btn-primary'}`,
          text: options.confirmText || '确定',
          onclick: () => {
            if (options.onConfirm) {
              const result = options.onConfirm(modalEl);
              if (result !== false) closeModal();
            } else {
              closeModal();
            }
          }
        });
        footer.appendChild(confirmBtn);
      }
      modalEl.appendChild(footer);
    }

    backdrop.appendChild(modalEl);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    container.appendChild(backdrop);

    // ESC to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    function closeModal() {
      backdrop.style.animation = 'modalFadeIn 0.2s reverse';
      modalEl.style.animation = 'modalSlideIn 0.2s reverse';
      setTimeout(() => {
        backdrop.remove();
        document.removeEventListener('keydown', escHandler);
      }, 200);
    }

    return { el: modalEl, close: closeModal };
  }

  // ===== Confirm Dialog =====
  function confirm(options) {
    return new Promise((resolve) => {
      const m = modal({
        title: '',
        size: 'sm',
        footer: false,
        body: createEl('div', {
          class: 'confirm-dialog',
          html: `
            <div class="confirm-icon">${icons.alert}</div>
            <div class="confirm-text">${escapeHtml(options.title || '确认操作')}</div>
            <div class="confirm-subtext">${escapeHtml(options.text || '此操作不可撤销，请确认是否继续。')}</div>
          `
        })
      });

      const footer = createEl('div', { class: 'modal-footer' });
      footer.style.justifyContent = 'center';
      footer.style.gap = '12px';
      footer.style.padding = '16px 24px 24px';

      footer.appendChild(createEl('button', {
        class: 'btn',
        text: options.cancelText || '取消',
        onclick: () => { m.close(); resolve(false); }
      }));

      footer.appendChild(createEl('button', {
        class: 'btn btn-danger',
        text: options.confirmText || '删除',
        onclick: () => { m.close(); resolve(true); }
      }));

      m.el.appendChild(footer);
    });
  }

  function showInput(options) {
    return new Promise((resolve) => {
      const inputId = 'show-input-' + Date.now();
      const m = modal({
        title: options.title || '输入',
        size: 'sm',
        footer: false,
        body: createEl('div', {
          class: 'confirm-dialog',
          html: `
            ${options.text ? `<div class="confirm-subtext" style="margin-bottom:16px;">${escapeHtml(options.text)}</div>` : ''}
            <input type="text" class="form-input" id="${inputId}" placeholder="${escapeHtml(options.placeholder || '')}" style="text-align:center;">
          `
        })
      });

      const footer = createEl('div', { class: 'modal-footer' });
      footer.style.justifyContent = 'center';
      footer.style.gap = '12px';
      footer.style.padding = '16px 24px 24px';

      footer.appendChild(createEl('button', {
        class: 'btn',
        text: options.cancelText || '取消',
        onclick: () => { m.close(); resolve(null); }
      }));

      footer.appendChild(createEl('button', {
        class: 'btn btn-primary',
        text: options.confirmText || '确定',
        onclick: () => {
          const val = document.getElementById(inputId).value.trim();
          if (!val) return;
          m.close();
          resolve(val);
        }
      }));

      m.el.appendChild(footer);

      // Auto focus + enter to confirm
      setTimeout(() => {
        const inp = document.getElementById(inputId);
        if (inp) {
          inp.focus();
          inp.onkeydown = (e) => {
            if (e.key === 'Enter') {
              const v = inp.value.trim();
              if (v) { m.close(); resolve(v); }
            }
          };
        }
      }, 100);
    });
  }

  // ===== Image Handling =====
  function fileToBase64(file, callback) {
    // Use canvas to compress/resize the image before storing
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_SIZE = 800;
        let { width, height } = img;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round(height * (MAX_SIZE / width));
            width = MAX_SIZE;
          } else {
            width = Math.round(width * (MAX_SIZE / height));
            height = MAX_SIZE;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        callback(compressed);
      };
      img.onerror = () => callback(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => callback(null);
    reader.readAsDataURL(file);
  }

  // Get approximate data usage in KB (works with both IndexedDB and localStorage)
  function getStorageUsage() {
    try {
      if (TT.Store && TT.Store.getData) {
        const data = TT.Store.getData();
        return Math.round(JSON.stringify(data).length / 1024);
      }
      const raw = localStorage.getItem('tt-workspace-data') || '';
      return Math.round(raw.length / 1024);
    } catch (e) {
      return 0;
    }
  }

  // ===== Debounce =====
  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  return {
    uid,
    $, $$,
    createEl,
    formatDate,
    formatDateInput,
    todayStr,
    isToday,
    isOverdue,
    relativeDate,
    getGreeting,
    getWeekRange,
    isThisWeek,
    escapeHtml,
    icons,
    icon,
    toast,
    modal,
    confirm,
    showInput,
    fileToBase64,
    getStorageUsage,
    debounce
  };
})();
