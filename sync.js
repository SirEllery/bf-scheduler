// sync.js — Google Sheets sync for Bath Foundry Scheduler
// Uses a Google Apps Script web app as backend (see gas-backend.js for setup)

(function() {
  'use strict';

  var SYNC_URL_KEY = 'bf_sync_url';
  var syncStatus = 'idle'; // idle, syncing, synced, error
  var syncTimer = null;
  var DEBOUNCE_MS = 2000; // debounce saves to avoid hammering the API

  // ── Get/Set sync URL ──
  function getSyncUrl() {
    return localStorage.getItem(SYNC_URL_KEY) || '';
  }

  function setSyncUrl(url) {
    localStorage.setItem(SYNC_URL_KEY, url.trim());
  }

  // ── Strip photos before sync (too large for Sheets) ──
  function stripPhotos(jobs) {
    return jobs.map(function(job) {
      var copy = Object.assign({}, job);
      copy.photos = []; // skip photos — base64 data is too large for Google Sheets
      if (copy.tasks) {
        copy.tasks = copy.tasks.map(function(t) {
          return Object.assign({}, t);
        });
      }
      return copy;
    });
  }

  // ── Merge: restore local photos onto synced data ──
  function restorePhotos(remoteJobs, localJobs) {
    if (!localJobs || !remoteJobs) return remoteJobs;
    var localMap = {};
    localJobs.forEach(function(j) { localMap[j.id] = j; });
    return remoteJobs.map(function(job) {
      var local = localMap[job.id];
      if (local && local.photos && local.photos.length) {
        job.photos = local.photos;
      }
      return job;
    });
  }

  // ── Update sync indicator UI ──
  function updateSyncIndicator(status, message) {
    syncStatus = status;
    var el = document.getElementById('syncIndicator');
    if (!el) return;
    
    var icons = { idle: '☁️', syncing: '🔄', synced: '☁️', error: '⚠️' };
    var titles = { 
      idle: 'Sync not configured', 
      syncing: 'Syncing...', 
      synced: 'Synced', 
      error: message || 'Sync error' 
    };
    
    el.textContent = icons[status] || '☁️';
    el.title = titles[status] || '';
    el.className = 'sync-indicator sync-' + status;
  }

  // ── Load from Google Sheet ──
  function syncLoad(callback) {
    var url = getSyncUrl();
    if (!url) {
      updateSyncIndicator('idle');
      if (callback) callback(null);
      return;
    }

    updateSyncIndicator('syncing');

    fetch(url)
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function(remoteJobs) {
        if (!Array.isArray(remoteJobs)) {
          throw new Error('Invalid data from sheet');
        }
        
        // Get local jobs for photo restoration
        var localRaw = localStorage.getItem('bf_jobs');
        var localJobs = null;
        if (localRaw) {
          try { localJobs = JSON.parse(localRaw); } catch(e) {}
        }
        
        // Restore photos from local storage
        var merged = restorePhotos(remoteJobs, localJobs);
        
        // Save to localStorage as source of truth
        localStorage.setItem('bf_jobs', JSON.stringify(merged));
        
        updateSyncIndicator('synced');
        if (callback) callback(merged);
      })
      .catch(function(err) {
        console.warn('Sync load failed:', err);
        updateSyncIndicator('error', err.message);
        if (callback) callback(null);
      });
  }

  // ── Save to Google Sheet ──
  function syncSave(jobs) {
    var url = getSyncUrl();
    if (!url || !jobs) {
      return;
    }

    // Debounce
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function() {
      doSyncSave(url, jobs);
    }, DEBOUNCE_MS);
  }

  function doSyncSave(url, jobs) {
    updateSyncIndicator('syncing');

    var payload = JSON.stringify(stripPhotos(jobs));

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      mode: 'no-cors' // GAS requires this for cross-origin POST
    })
    .then(function() {
      // no-cors means we can't read the response, but if it didn't throw, it's likely ok
      updateSyncIndicator('synced');
    })
    .catch(function(err) {
      console.warn('Sync save failed:', err);
      updateSyncIndicator('error', err.message);
    });
  }

  // ── Settings dialog ──
  function showSyncSettings() {
    var currentUrl = getSyncUrl();
    
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML =
      '<div class="confirm-box" style="min-width:320px;max-width:440px">' +
        '<div class="confirm-msg">Sync Settings</div>' +
        '<div style="margin:12px 0">' +
          '<label style="font-size:13px;color:#aab;display:block;margin-bottom:6px">Google Apps Script Web App URL</label>' +
          '<input type="url" id="syncUrlInput" value="' + currentUrl.replace(/"/g, '&quot;') + '" ' +
            'placeholder="https://script.google.com/macros/s/.../exec" ' +
            'style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #444;background:#1e1e2e;color:#ddd;font-size:13px;box-sizing:border-box" />' +
        '</div>' +
        '<div style="font-size:11px;color:#667;margin-bottom:12px">' +
          '📷 Photos stay on this device only (too large for Google Sheets).<br>' +
          '📖 See gas-backend.js for setup instructions.' +
        '</div>' +
        '<div class="confirm-btns">' +
          '<button class="confirm-btn confirm-cancel" id="syncSettingsCancel">Cancel</button>' +
          '<button class="confirm-btn confirm-save" id="syncSettingsSave">Save</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var input = document.getElementById('syncUrlInput');
    input.focus();
    input.select();

    document.getElementById('syncSettingsSave').addEventListener('click', function() {
      setSyncUrl(input.value);
      document.body.removeChild(overlay);
      // If URL was set, do an initial load
      if (input.value.trim()) {
        syncLoad(function(data) {
          if (data) {
            // Reload the app with synced data
            location.reload();
          }
        });
      } else {
        updateSyncIndicator('idle');
      }
    });

    document.getElementById('syncSettingsCancel').addEventListener('click', function() {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  }

  // ── Public API ──
  window.syncLoad = syncLoad;
  window.syncSave = syncSave;
  window.showSyncSettings = showSyncSettings;
  window.updateSyncIndicator = updateSyncIndicator;

  // Initialize indicator on load
  if (!getSyncUrl()) {
    updateSyncIndicator('idle');
  }

})();
