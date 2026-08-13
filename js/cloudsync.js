/* ============================================
   TT工作台 - Cloud Sync via GitHub API
   自动将数据备份到 GitHub 仓库
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
  let syncTimer = null;
  let lastSyncTime = null;
  let syncStatus = 'idle'; // idle | syncing | success | error | notoken

  async function getToken() {
    try {
      return await TT.IDB.get(IDB_TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  async function setToken(token) {
    await TT.IDB.set(IDB_TOKEN_KEY, token);
  }

  async function removeToken() {
    try {
      await TT.IDB.set(IDB_TOKEN_KEY, '');
    } catch (e) {}
  }

  // Debounced sync trigger - called after every data save
  function schedule() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      sync();
    }, 5000); // 5 second debounce
  }

  async function sync() {
    const token = await getToken();
    if (!token) {
      syncStatus = 'notoken';
      updateStatusUI();
      return;
    }

    syncStatus = 'syncing';
    updateStatusUI();

    try {
      const data = TT.Store.exportData();
      // Base64 encode (UTF-8 safe)
      const b64 = btoa(unescape(encodeURIComponent(data)));

      // Get current file SHA (needed to update existing file)
      let sha = null;
      const getUrl = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/${GH_CONFIG.path}?ref=${GH_CONFIG.branch}`;
      const getResp = await fetch(getUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (getResp.ok) {
        const fileData = await getResp.json();
        sha = fileData.sha;
      } else if (getResp.status !== 404) {
        throw new Error(`GitHub API GET failed: ${getResp.status}`);
      }

      // Update or create file
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
          sha: sha,
          branch: GH_CONFIG.branch
        })
      });

      if (!putResp.ok) {
        const errBody = await putResp.text();
        throw new Error(`GitHub API PUT failed: ${putResp.status} ${errBody}`);
      }

      syncStatus = 'success';
      lastSyncTime = new Date();
      updateStatusUI();
      console.log('[CloudSync] Backup successful at', lastSyncTime);
    } catch (e) {
      console.error('[CloudSync] Sync failed:', e);
      syncStatus = 'error';
      updateStatusUI();
    }
  }

  // Pull data from cloud (restore from GitHub)
  async function pull() {
    const token = await getToken();
    if (!token) {
      TT.Utils.toast('请先设置 GitHub Token', 'error');
      return false;
    }

    try {
      const url = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/${GH_CONFIG.path}?ref=${GH_CONFIG.branch}`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!resp.ok) throw new Error(`API failed: ${resp.status}`);

      const fileData = await resp.json();
      // Decode base64 (UTF-8 safe)
      const jsonStr = decodeURIComponent(escape(atob(fileData.content)));
      const success = await TT.Store.importData(jsonStr);
      if (success) {
        TT.Utils.toast('云端数据已恢复');
        return true;
      } else {
        TT.Utils.toast('数据格式错误', 'error');
        return false;
      }
    } catch (e) {
      console.error('[CloudSync] Pull failed:', e);
      TT.Utils.toast('拉取云端数据失败', 'error');
      return false;
    }
  }

  // Token setup modal
  async function showTokenSettings() {
    const currentToken = await getToken();

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">GitHub Personal Access Token</label>
        <input type="password" class="form-input" id="gh-token-input" placeholder="ghp_xxxx..." value="${currentToken ? TT.Utils.escapeHtml(currentToken) : ''}">
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:6px;line-height:1.5;">
          Token 需要 <code>repo</code> 权限。<br>
          <a href="https://github.com/settings/tokens/new" target="_blank" style="color:var(--accent-blue);">点此创建 Token</a>
        </div>
      </div>
      <div style="background:var(--glass-bg);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;font-size:13px;color:var(--text-secondary);line-height:1.6;">
        <strong>当前状态：</strong><span id="sync-status-text">${getStatusText()}</span><br>
        ${lastSyncTime ? `<strong>上次同步：</strong>${TT.Utils.formatDate(lastSyncTime, 'datetime')}` : ''}
      </div>
    `;

    TT.Utils.modal({
      title: '云端同步设置',
      body: body,
      confirmText: '保存',
      onConfirm: async () => {
        const token = document.getElementById('gh-token-input').value.trim();
        if (token) {
          await setToken(token);
          TT.Utils.toast('Token 已保存，开始同步...');
          sync();
        } else {
          await removeToken();
          TT.Utils.toast('已清除 Token');
        }
      }
    });

    // Add pull button
    const modal = document.querySelector('.modal-footer');
    if (modal && currentToken) {
      const pullBtn = TT.Utils.createEl('button', {
        class: 'btn',
        text: '从云端恢复',
        style: 'margin-right:auto;',
        onclick: async () => {
          const ok = await TT.Utils.confirm({
            title: '从云端恢复',
            text: '这将用云端数据覆盖当前本地数据，确定继续？'
          });
          if (ok) {
            const success = await pull();
            if (success) {
              setTimeout(() => location.reload(), 1000);
            }
          }
        }
      });
      modal.insertBefore(pullBtn, modal.firstChild);
    }
  }

  function getStatusText() {
    switch (syncStatus) {
      case 'syncing': return '正在同步...';
      case 'success': return '已同步';
      case 'error': return '同步失败';
      case 'notoken': return '未设置 Token';
      default: return '空闲';
    }
  }

  function getStatusIcon() {
    switch (syncStatus) {
      case 'syncing': return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent-blue);animation:pulse 1.5s infinite;"></span>';
      case 'success': return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#34c759;"></span>';
      case 'error': return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3b30;"></span>';
      case 'notoken': return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--text-tertiary);"></span>';
      default: return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--text-tertiary);"></span>';
    }
  }

  function updateStatusUI() {
    const el = document.getElementById('cloud-sync-indicator');
    if (el) {
      el.innerHTML = getStatusIcon();
      el.title = '云端同步: ' + getStatusText();
    }
    const textEl = document.getElementById('sync-status-text');
    if (textEl) {
      textEl.textContent = getStatusText();
    }
  }

  // Check token on load and show indicator in sidebar
  async function init() {
    const token = await getToken();
    if (token) {
      syncStatus = 'idle';
    } else {
      syncStatus = 'notoken';
    }
    updateStatusUI();
  }

  return {
    init,
    schedule,
    sync,
    pull,
    showTokenSettings,
    getStatusText,
    getStatusIcon,
    updateStatusUI
  };
})();
