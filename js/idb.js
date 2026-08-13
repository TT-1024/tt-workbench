/* ============================================
   TT工作台 - IndexedDB Wrapper
   替代 localStorage，支持大容量数据存储
   ============================================ */

window.TT = window.TT || {};

TT.IDB = (function() {
  const DB_NAME = 'tt-workbench-db';
  const STORE_NAME = 'kv';
  const DB_VERSION = 1;
  let db = null;
  let ready = false;

  function init() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => {
        db = e.target.result;
        ready = true;
        resolve(db);
      };
      req.onerror = (e) => reject(e.target.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
  }

  function get(key) {
    return new Promise((resolve, reject) => {
      if (!db) { resolve(null); return; }
      try {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  function set(key, value) {
    return new Promise((resolve, reject) => {
      if (!db) { resolve(false); return; }
      try {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        tx.objectStore(STORE_NAME).put({ key, value });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      } catch (e) { reject(e); }
    });
  }

  function remove(key) {
    return new Promise((resolve, reject) => {
      if (!db) { resolve(false); return; }
      try {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      } catch (e) { reject(e); }
    });
  }

  function isReady() { return ready; }

  return { init, get, set, remove, isReady };
})();
