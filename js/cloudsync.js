/* ============================================
   TT工作台 - Safe two-way cloud sync via GitHub
   ============================================ */

window.TT = window.TT || {};

TT.CloudSync = (function() {
  const GH_CONFIG = {
    owner: 'TT-1024',
    repo: 'tt-workbench',
    branch: 'master',
    path: 'data-backup.json'
  };

  const IDB_TOKEN_KEY = 'gh-sync-token';
  const IDB_STATE_KEY = 'gh-sync-state-v2';
  const CHECK_INTERVAL = 5 * 60 * 1000;
  let syncTimer = null;
  let checkTimer = null;
  let syncPromise = null;
  let readyForUpload = false;
  let lastSyncTime = null;
  let syncStatus = 'idle'; // idle | checking | syncing | success | error | notoken | conflict
  let statusDetail = '';

  async function getToken() {
    try { return await TT.IDB.get(IDB_TOKEN_KEY); } catch (e) { return null; }
  }

  async function setToken(token) {
    await TT.IDB.set(IDB_TOKEN_KEY, token);
  }

  async function removeToken() {
    try { await TT.IDB.set(IDB_TOKEN_KEY, ''); } catch (e) {}
  }

  async function getState() {
    try {
      const raw = await TT.IDB.get(IDB_STATE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  async function setState(patch) {
    const current = await getState();
    await TT.IDB.set(IDB_STATE_KEY, JSON.stringify(Object.assign({}, current, patch)));
  }

  function normalizedJson(jsonStr) {
    return JSON.stringify(JSON.parse(jsonStr));
  }

  async function hashJson(jsonStr) {
    const bytes = new TextEncoder().encode(normalizedJson(jsonStr));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function countRecords(data) {
    const len = value => Array.isArray(value) ? value.length : 0;
    const objectArrays = value => value && typeof value === 'object'
      ? Object.values(value).reduce((sum, item) => sum + len(item), 0) : 0;
    return len(data.tasks && data.tasks.daily) +
      len(data.tasks && data.tasks.weekly) +
      len(data.tasks && data.tasks.longterm) +
      len(data.tasks && data.tasks.habits) +
      len(data.learning && data.learning.baoyan) +
      len(data.learning && data.learning.chuguo) +
      len(data.learning && data.learning.keyan) +
      len(data.podcasts) + len(data.album) + len(data.inspirations) +
      len(data.conversations) + len(data.food && data.food.milktea) +
      len(data.food && data.food.finedining) + objectArrays(data.customModules) +
      objectArrays(data.notes);
  }

  async function localSnapshot() {
    const json = TT.Store.exportData();
    return { json, hash: await hashJson(json), count: countRecords(JSON.parse(json)) };
  }

  async function fetchRemote() {
    const token = await getToken();
    const url = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/${GH_CONFIG.path}?ref=${GH_CONFIG.branch}&t=${Date.now()}`;
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const resp = await fetch(url, { headers, cache: 'no-store' });
    if (!resp.ok) throw new Error(`GitHub API GET failed: ${resp.status}`);
    const fileData = await resp.json();
    let json;
    if (fileData.content) {
      json = decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, ''))));
    } else {
      // GitHub omits inline content for files larger than 1 MB.
      const downloadHeaders = {};
      if (token) downloadHeaders.Authorization = `Bearer ${token}`;
      const downloadResp = await fetch(`${fileData.download_url}?t=${Date.now()}`, {
        headers: downloadHeaders,
        cache: 'no-store'
      });
      if (!downloadResp.ok) throw new Error(`GitHub raw download failed: ${downloadResp.status}`);
      json = await downloadResp.text();
    }
    return {
      json,
      hash: await hashJson(json),
      count: countRecords(JSON.parse(json)),
      sha: fileData.sha
    };
  }

  async function applyRemote(remote, notify) {
    const success = await TT.Store.importData(remote.json, { skipCloudSync: true });
    if (!success) throw new Error('Invalid cloud backup');
    const appliedLocal = await localSnapshot();
    await setState({
      lastSyncedHash: appliedLocal.hash,
      lastLocalHash: appliedLocal.hash,
      lastRemoteHash: remote.hash,
      lastRemoteSha: remote.sha,
      lastPullAt: new Date().toISOString()
    });
    lastSyncTime = new Date();
    syncStatus = 'success';
    statusDetail = '已下载云端最新数据';
    updateStatusUI();
    if (notify) {
      TT.Utils.toast('已自动更新云端数据');
      setTimeout(() => location.reload(), 700);
    }
    return true;
  }

  function markConflict(message) {
    syncStatus = 'conflict';
    statusDetail = message || '本机和云端都有新改动';
    updateStatusUI();
    TT.Utils.toast('检测到同步冲突，已暂停自动覆盖', 'error');
  }

  async function checkRemote(options) {
    options = options || {};
    if (syncPromise && !options.fromSync) return syncPromise;

    syncStatus = 'checking';
    statusDetail = '正在检查云端版本';
    updateStatusUI();

    try {
      const [remote, local, state, token] = await Promise.all([
        fetchRemote(), localSnapshot(), getState(), getToken()
      ]);

      if (remote.hash === local.hash) {
        await setState({
          lastSyncedHash: local.hash,
          lastLocalHash: local.hash,
          lastRemoteHash: remote.hash,
          lastRemoteSha: remote.sha
        });
        syncStatus = 'success';
        statusDetail = '已是最新版本';
        lastSyncTime = new Date();
        updateStatusUI();
        return { action: 'same' };
      }

      const baselineLocal = state.lastLocalHash || state.lastSyncedHash;
      const baselineRemote = state.lastRemoteHash || state.lastSyncedHash;

      if (!baselineLocal || !baselineRemote) {
        // A device without upload credentials is a read-only replica.
        // On first use, the cloud is always authoritative.
        if (!token) {
          await applyRemote(remote, options.notify !== false);
          return { action: 'pulled' };
        }
        if (local.count === 0 && remote.count > 0) {
          await applyRemote(remote, options.notify !== false);
          return { action: 'pulled' };
        }
        if (remote.count === 0 && local.count > 0) {
          await setState({
            lastSyncedHash: local.hash,
            lastLocalHash: local.hash,
            lastRemoteHash: remote.hash,
            lastRemoteSha: remote.sha
          });
          if (token) schedule(300);
          else {
            syncStatus = 'notoken';
            statusDetail = '本机有未上传的数据';
            updateStatusUI();
          }
          return { action: 'local-newer' };
        }
        markConflict('首次同步时本机和云端都有数据');
        return { action: 'conflict' };
      }

      const localChanged = local.hash !== baselineLocal;
      const remoteChanged = remote.hash !== baselineRemote;
      if (remoteChanged && !localChanged) {
        await applyRemote(remote, options.notify !== false);
        return { action: 'pulled' };
      }
      if (remoteChanged && localChanged) {
        markConflict();
        return { action: 'conflict' };
      }
      if (!remoteChanged && localChanged) {
        if (token) schedule(300);
        else {
          syncStatus = 'notoken';
          statusDetail = '本机改动尚未上传';
          updateStatusUI();
        }
        return { action: 'local-newer' };
      }

      syncStatus = 'success';
      statusDetail = '已是最新版本';
      updateStatusUI();
      return { action: 'same' };
    } catch (e) {
      console.error('[CloudSync] Check failed:', e);
      syncStatus = 'error';
      statusDetail = '无法连接云端';
      updateStatusUI();
      if (!options.silent) TT.Utils.toast('检查云端数据失败', 'error');
      return { action: 'error' };
    }
  }

  function schedule(delay) {
    if (!readyForUpload) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => sync(), typeof delay === 'number' ? delay : 5000);
  }

  async function sync(options) {
    options = options || {};
    if (syncPromise) return syncPromise;
    syncPromise = (async () => {
      const token = await getToken();
      if (!token) {
        syncStatus = 'notoken';
        statusDetail = '可自动下载，上传需设置 Token';
        updateStatusUI();
        return false;
      }

      syncStatus = 'syncing';
      statusDetail = '正在安全上传';
      updateStatusUI();

      try {
        const [remote, local, state] = await Promise.all([fetchRemote(), localSnapshot(), getState()]);

        if (local.hash === remote.hash) {
          await setState({
            lastSyncedHash: local.hash,
            lastLocalHash: local.hash,
            lastRemoteHash: remote.hash,
            lastRemoteSha: remote.sha
          });
          syncStatus = 'success';
          statusDetail = '已同步';
          lastSyncTime = new Date();
          updateStatusUI();
          return true;
        }

        if (!options.force && remote.count > 0 && local.count === 0) {
          await applyRemote(remote, true);
          return true;
        }

        const baselineLocal = state.lastLocalHash || state.lastSyncedHash;
        const baselineRemote = state.lastRemoteHash || state.lastSyncedHash;
        if (!options.force && baselineLocal && baselineRemote &&
            remote.hash !== baselineRemote && local.hash !== baselineLocal) {
          markConflict();
          return false;
        }

        const b64 = btoa(unescape(encodeURIComponent(local.json)));
        const putUrl = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/${GH_CONFIG.path}`;
        const putResp = await fetch(putUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `auto: data backup ${new Date().toISOString().slice(0, 19)}`,
            content: b64,
            sha: remote.sha,
            branch: GH_CONFIG.branch
          })
        });
        if (!putResp.ok) throw new Error(`GitHub API PUT failed: ${putResp.status}`);

        const result = await putResp.json();
        await setState({
          lastSyncedHash: local.hash,
          lastLocalHash: local.hash,
          lastRemoteHash: local.hash,
          lastRemoteSha: result.content && result.content.sha,
          lastPushAt: new Date().toISOString()
        });
        syncStatus = 'success';
        statusDetail = '已同步';
        lastSyncTime = new Date();
        updateStatusUI();
        console.log('[CloudSync] Backup successful at', lastSyncTime);
        return true;
      } catch (e) {
        console.error('[CloudSync] Sync failed:', e);
        syncStatus = 'error';
        statusDetail = '上传失败，本地数据仍安全保留';
        updateStatusUI();
        return false;
      }
    })();

    try { return await syncPromise; }
    finally { syncPromise = null; }
  }

  async function pull() {
    try {
      const remote = await fetchRemote();
      return await applyRemote(remote, false);
    } catch (e) {
      console.error('[CloudSync] Pull failed:', e);
      TT.Utils.toast('拉取云端数据失败', 'error');
      return false;
    }
  }

  async function showTokenSettings() {
    const currentToken = await getToken();
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="background:var(--glass-bg);border-radius:var(--radius-sm);padding:12px;margin-bottom:16px;font-size:13px;color:var(--text-secondary);line-height:1.7;">
        <strong>同步状态：</strong><span id="sync-status-text">${getStatusText()}</span><br>
        <span id="sync-status-detail">${TT.Utils.escapeHtml(statusDetail)}</span>
      </div>
      <div class="form-group">
        <label class="form-label">GitHub Personal Access Token</label>
        <input type="password" class="form-input" id="gh-token-input" placeholder="ghp_xxxx..." value="${currentToken ? TT.Utils.escapeHtml(currentToken) : ''}">
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:6px;line-height:1.5;">
          下载云端数据无需 Token；需要从这台设备上传时才需要。
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn" id="sync-use-cloud">使用云端版本</button>
        ${currentToken ? '<button type="button" class="btn btn-danger" id="sync-use-local">用本机覆盖云端</button>' : ''}
      </div>`;

    TT.Utils.modal({
      title: '自动云同步',
      body,
      confirmText: '保存并安全同步',
      onConfirm: async () => {
        const token = document.getElementById('gh-token-input').value.trim();
        if (token) await setToken(token);
        else await removeToken();
        TT.Utils.toast('正在先检查云端版本...');
        const result = await checkRemote({ notify: true });
        if (token && result.action === 'local-newer') schedule(300);
      }
    });

    document.getElementById('sync-use-cloud').onclick = async () => {
      const ok = await TT.Utils.confirm({
        title: '使用云端版本',
        text: '将用云端数据替换这台设备的本地数据，确定继续？'
      });
      if (ok && await pull()) setTimeout(() => location.reload(), 500);
    };

    const useLocalBtn = document.getElementById('sync-use-local');
    if (useLocalBtn) useLocalBtn.onclick = async () => {
      const ok = await TT.Utils.confirm({
        title: '用本机覆盖云端',
        text: '这会用当前设备的数据替换云端备份，仅在确认本机更新时使用。'
      });
      if (ok) {
        const success = await sync({ force: true });
        TT.Utils.toast(success ? '已用本机数据更新云端' : '更新云端失败', success ? 'success' : 'error');
      }
    };

    const footer = document.querySelector('.modal-footer');
    if (footer) {
      const checkBtn = TT.Utils.createEl('button', {
        class: 'btn', text: '立即检查云端', style: 'margin-right:auto;',
        onclick: async () => {
          const result = await checkRemote({ notify: true });
          if (result.action === 'same') TT.Utils.toast('已是最新数据');
        }
      });
      footer.insertBefore(checkBtn, footer.firstChild);
    }
  }

  function getStatusText() {
    switch (syncStatus) {
      case 'checking': return '正在检查...';
      case 'syncing': return '正在同步...';
      case 'success': return '已同步';
      case 'error': return '同步失败';
      case 'notoken': return '只读同步';
      case 'conflict': return '需要处理冲突';
      default: return '等待同步';
    }
  }

  function getStatusIcon() {
    const colors = {
      checking: 'var(--accent-blue)', syncing: 'var(--accent-blue)',
      success: '#34c759', error: '#ff3b30', conflict: '#ff9f0a',
      notoken: 'var(--text-tertiary)', idle: 'var(--text-tertiary)'
    };
    const animated = syncStatus === 'checking' || syncStatus === 'syncing' ? 'animation:pulse 1.5s infinite;' : '';
    return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[syncStatus] || colors.idle};${animated}"></span>`;
  }

  function updateStatusUI() {
    const el = document.getElementById('cloud-sync-indicator');
    if (el) {
      el.innerHTML = getStatusIcon();
      el.title = '云端同步: ' + getStatusText();
    }
    const textEl = document.getElementById('sync-status-text');
    if (textEl) textEl.textContent = getStatusText();
    const detailEl = document.getElementById('sync-status-detail');
    if (detailEl) detailEl.textContent = statusDetail;
  }

  async function init() {
    const initialResult = await checkRemote({ notify: false, silent: true });
    readyForUpload = true;
    if (initialResult && initialResult.action === 'local-newer' && await getToken()) schedule(300);
    if (checkTimer) clearInterval(checkTimer);
    checkTimer = setInterval(() => checkRemote({ notify: true, silent: true }), CHECK_INTERVAL);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkRemote({ notify: true, silent: true });
    });
  }

  return {
    init, schedule, sync, pull, checkRemote, showTokenSettings,
    getStatusText, getStatusIcon, updateStatusUI
  };
})();
