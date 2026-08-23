/* ============================================
   TT工作台 - Data Store (localStorage)
   ============================================ */

window.TT = window.TT || {};

TT.Store = (function() {
  const STORAGE_KEY = 'tt-workspace-data';
  const IDB_KEY = 'tt-workspace-data';
  const DATA_VERSION = 1;
  let usingIDB = false;

  const defaultData = {
    version: DATA_VERSION,
    sidebar: {
      collapsed: false,
      modules: [
        { id: 'dashboard', name: '首页', icon: 'home', order: 0, locked: true },
        { id: 'planning', name: '计划', icon: 'calendar', order: 1, locked: true },
        { id: 'learning', name: '学习', icon: 'book', order: 2, locked: true },
        { id: 'podcast', name: '播客感悟记录', icon: 'mic', order: 3, locked: true },
        { id: 'food', name: '美食记录', icon: 'utensils', order: 4, locked: true },
        { id: 'album', name: '相册', icon: 'image', order: 5, locked: true },
        { id: 'inspiration', name: '灵感', icon: 'lightbulb', order: 6, locked: true },
        { id: 'conversation', name: '谈话记录', icon: 'chat', order: 7, locked: true }
      ]
    },
    tasks: {
      daily: [],
      weekly: [],
      longterm: [],
      habits: []
    },
    learning: {
      englishSpeakingDates: [],
      englishPhrases: [],
      baoyan: [],
      chuguo: [],
      keyan: []
    },
    podcasts: [],
    album: [],
    inspirations: [],
    conversations: [],
    food: {
      milktea: [],
      milkteaDates: [],
      finedining: []
    },
    podcastCategories: ['创业', '做人', '成长', '商业', '科技'],
    albumCategories: ['tt&ll', '恶搞之家', '家人'],
    conversationCategories: ['大生赛', '论文'],
    customModules: {},
    notes: {}
  };

  let data = null;

  async function load() {
    // Try IndexedDB first (much larger capacity)
    try {
      await TT.IDB.init();
      usingIDB = true;
      const stored = await TT.IDB.get(IDB_KEY);
      if (stored) {
        data = JSON.parse(stored);
        data = deepMerge(defaultData, data);
        ensureDefaultModules();
        migrateAlbumCategories();
        migrateConversationCategories();
        return data;
      }
    } catch (e) {
      console.warn('IndexedDB unavailable, using localStorage fallback', e);
    }

    // Fallback / migration: try localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        data = JSON.parse(raw);
        data = deepMerge(defaultData, data);
        ensureDefaultModules();
        migrateAlbumCategories();
        migrateConversationCategories();
        // Migrate to IndexedDB if available
        if (usingIDB) {
          await TT.IDB.set(IDB_KEY, JSON.stringify(data));
          console.log('Data migrated from localStorage to IndexedDB');
        }
        return data;
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }

    // No data found, initialize defaults
    data = JSON.parse(JSON.stringify(defaultData));
    await save();
    return data;
  }

  // Ensure all default locked sidebar modules exist (handles data exported before new modules were added)
  function ensureDefaultModules() {
    if (!data.sidebar || !data.sidebar.modules) return;
    const existingIds = data.sidebar.modules.map(m => m.id);
    let changed = false;
    defaultData.sidebar.modules.forEach(defMod => {
      if (defMod.locked && !existingIds.includes(defMod.id)) {
        data.sidebar.modules.push(JSON.parse(JSON.stringify(defMod)));
        changed = true;
      }
    });
    if (changed) {
      data.sidebar.modules.sort((a, b) => (a.order || 0) - (b.order || 0));
      save();
    }
  }

  // Migrate old album category names to new ones
  function migrateAlbumCategories() {
    const renameMap = { '对象': 'tt&ll', '4人朋友': '恶搞之家' };
    let changed = false;

    // Rename in albumCategories array, and remove '3人朋友'
    if (data.albumCategories) {
      const oldCats = [...data.albumCategories];
      data.albumCategories = data.albumCategories
        .filter(c => c !== '3人朋友' && c !== '5人朋友')
        .map(c => renameMap[c] || c);
      // Deduplicate
      data.albumCategories = [...new Set(data.albumCategories)];
      // Ensure all defaults exist
      defaultData.albumCategories.forEach(c => {
        if (!data.albumCategories.includes(c)) {
          data.albumCategories.push(c);
          changed = true;
        }
      });
      if (JSON.stringify(oldCats) !== JSON.stringify(data.albumCategories)) changed = true;
    }

    // Rename category on existing album items
    if (data.album) {
      data.album.forEach(item => {
        if (item.category && renameMap[item.category]) {
          item.category = renameMap[item.category];
          changed = true;
        }
        if (item.category === '3人朋友' || item.category === '5人朋友') {
          item.category = '';
          changed = true;
        }
      });
    }

    if (changed) save();
  }

  function migrateConversationCategories() {
    if (!Array.isArray(data.conversationCategories) || data.conversationCategories.length === 0) {
      data.conversationCategories = ['大生赛', '论文'];
    }
    (data.conversations || []).forEach(item => {
      if (!item.category || item.category === '未分类') item.category = '大生赛';
      if (!data.conversationCategories.includes(item.category)) {
        data.conversationCategories.push(item.category);
      }
    });
  }

  async function save(options) {
    const skipCloudSync = options && options.skipCloudSync;
    const jsonStr = JSON.stringify(data);

    if (usingIDB) {
      try {
        await TT.IDB.set(IDB_KEY, jsonStr);
        // Trigger cloud sync (debounced, non-blocking)
        if (!skipCloudSync && TT.CloudSync && TT.CloudSync.schedule) {
          TT.CloudSync.schedule();
        }
        return;
      } catch (e) {
        console.error('IDB save failed, trying localStorage:', e);
      }
    }

    // localStorage fallback
    try {
      localStorage.setItem(STORAGE_KEY, jsonStr);
      if (!skipCloudSync && TT.CloudSync && TT.CloudSync.schedule) {
        TT.CloudSync.schedule();
      }
    } catch (e) {
      console.error('Failed to save:', e);
      if (e.name === 'QuotaExceededError') {
        TT.Utils.toast('存储空间已满，请删除一些旧记录或图片', 'error');
      }
    }
  }

  function deepMerge(target, source) {
    const result = JSON.parse(JSON.stringify(target));
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  function getData() {
    if (!data) load();
    return data;
  }

  // Generic CRUD
  function getCollection(path) {
    const d = getData();
    const keys = path.split('.');
    let val = d;
    for (const k of keys) {
      val = val[k];
      if (val === undefined) return [];
    }
    return Array.isArray(val) ? val : [];
  }

  function setCollection(path, items) {
    const d = getData();
    const keys = path.split('.');
    let obj = d;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = items;
    save();
  }

  function addItem(path, item) {
    const items = getCollection(path);
    item.id = TT.Utils.uid();
    item.createdAt = new Date().toISOString();
    items.push(item);
    setCollection(path, items);
    return item;
  }

  function updateItem(path, id, updates) {
    const items = getCollection(path);
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
      setCollection(path, items);
      return items[idx];
    }
    return null;
  }

  function removeItem(path, id) {
    const items = getCollection(path);
    const filtered = items.filter(i => i.id !== id);
    setCollection(path, filtered);
  }

  // Sidebar operations
  function getSidebarModules() {
    return getData().sidebar.modules.sort((a, b) => a.order - b.order);
  }

  function addSidebarModule(name, icon) {
    const d = getData();
    const id = 'custom_' + TT.Utils.uid();
    const order = d.sidebar.modules.length;
    d.sidebar.modules.push({ id, name, icon: icon || 'folder', order, locked: false });
    d.customModules[id] = [];
    save();
    return id;
  }

  function removeSidebarModule(id) {
    const d = getData();
    d.sidebar.modules = d.sidebar.modules.filter(m => m.id !== id);
    delete d.customModules[id];
    save();
  }

  function updateSidebarModule(id, updates) {
    const d = getData();
    const idx = d.sidebar.modules.findIndex(m => m.id === id);
    if (idx !== -1) {
      d.sidebar.modules[idx] = { ...d.sidebar.modules[idx], ...updates };
      save();
    }
  }

  function reorderSidebarModules(orderedIds) {
    const d = getData();
    orderedIds.forEach((id, index) => {
      const mod = d.sidebar.modules.find(m => m.id === id);
      if (mod) mod.order = index;
    });
    save();
  }

  function setSidebarCollapsed(collapsed) {
    const d = getData();
    d.sidebar.collapsed = collapsed;
    save();
  }

  // Podcast categories
  function addPodcastCategory(name) {
    const d = getData();
    if (!d.podcastCategories.includes(name)) {
      d.podcastCategories.push(name);
      save();
    }
  }

  function removePodcastCategory(name) {
    const d = getData();
    d.podcastCategories = d.podcastCategories.filter(c => c !== name);
    if (d.podcastCategories.length === 0) d.podcastCategories.push('未分类');
    const fallback = d.podcastCategories[0];
    (d.podcasts || []).forEach(item => {
      if (item.category === name) item.category = fallback;
    });
    save();
  }

  // Album categories
  function getAlbumCategories() {
    return getData().albumCategories || ['tt&ll', '恶搞之家', '家人'];
  }

  function addAlbumCategory(name) {
    const d = getData();
    if (!d.albumCategories) d.albumCategories = ['tt&ll', '恶搞之家', '家人'];
    if (!d.albumCategories.includes(name)) {
      d.albumCategories.push(name);
      save();
    }
  }

  function removeAlbumCategory(name) {
    const d = getData();
    d.albumCategories = getAlbumCategories().filter(c => c !== name);
    if (d.albumCategories.length === 0) d.albumCategories.push('未分类');
    const fallback = d.albumCategories[0];
    (d.album || []).forEach(item => {
      if (item.category === name) item.category = fallback;
    });
    save();
    return fallback;
  }

  function getConversationCategories() {
    return getData().conversationCategories || ['大生赛', '论文'];
  }

  function addConversationCategory(name) {
    const d = getData();
    if (!d.conversationCategories) d.conversationCategories = ['大生赛', '论文'];
    if (!d.conversationCategories.includes(name)) {
      d.conversationCategories.push(name);
      save();
    }
  }

  function removeConversationCategory(name) {
    const d = getData();
    d.conversationCategories = getConversationCategories().filter(c => c !== name);
    if (d.conversationCategories.length === 0) d.conversationCategories.push('大生赛');
    const fallback = d.conversationCategories[0];
    (d.conversations || []).forEach(item => {
      if ((item.category || '大生赛') === name) item.category = fallback;
    });
    save();
    return fallback;
  }

  // Reset
  function reset() {
    data = JSON.parse(JSON.stringify(defaultData));
    save();
  }

  // Export/Import
  function exportData() {
    return JSON.stringify(getData(), null, 2);
  }

  async function importData(jsonStr, options) {
    try {
      const imported = JSON.parse(jsonStr);
      data = deepMerge(defaultData, imported);
      // Ensure all default locked sidebar modules exist (e.g. album added later)
      if (data.sidebar && data.sidebar.modules) {
        const existingIds = data.sidebar.modules.map(m => m.id);
        defaultData.sidebar.modules.forEach(defMod => {
          if (defMod.locked && !existingIds.includes(defMod.id)) {
            data.sidebar.modules.push(JSON.parse(JSON.stringify(defMod)));
          }
        });
        // Re-sort by order
        data.sidebar.modules.sort((a, b) => (a.order || 0) - (b.order || 0));
      }
      migrateConversationCategories();
      await save(options); // Ensure data is fully saved before returning
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    load,
    save,
    getData,
    getCollection,
    setCollection,
    addItem,
    updateItem,
    removeItem,
    getSidebarModules,
    addSidebarModule,
    removeSidebarModule,
    updateSidebarModule,
    reorderSidebarModules,
    setSidebarCollapsed,
    addPodcastCategory,
    removePodcastCategory,
    getAlbumCategories,
    addAlbumCategory,
    removeAlbumCategory,
    getConversationCategories,
    addConversationCategory,
    removeConversationCategory,
    reset,
    exportData,
    importData
  };
})();
