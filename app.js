// app.js — Bath Foundry Schedule
// Pure vanilla JS, no dependencies

(function() {
  'use strict';

  // ── State ──
  var jobs = JSON.parse(JSON.stringify(SAMPLE_JOBS)); // deep clone
  var currentLevel = 1;  // 0=daily, 1=timeline, 2=project, 3=task
  var currentJobId = null;
  var currentTaskIndex = null;
  // Load saved edits from localStorage
  var saved = localStorage.getItem('bf_jobs');
  if (saved) {
    try { jobs = JSON.parse(saved); } catch(e) { /* use defaults */ }
  }

  // ── Undo Stack ──
  var undoStack = [];
  var MAX_UNDO = 5;

  function pushUndo() {
    undoStack.push(JSON.parse(JSON.stringify(jobs)));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    updateUndoBtn();
  }

  function undo() {
    if (undoStack.length === 0) return;
    jobs = undoStack.pop();
    saveState();
    updateUndoBtn();
    // Re-render current view
    if (currentLevel === 0) renderDaily(currentJobId);
    else if (currentLevel === 2) renderProject();
    else renderPortfolio();
  }

  function updateUndoBtn() {
    var btn = document.getElementById('undoBtn');
    if (btn) {
      if (undoStack.length === 0) btn.classList.add('disabled');
      else btn.classList.remove('disabled');
    }
  }

  function saveState() {
    try {
      localStorage.setItem('bf_jobs', JSON.stringify(jobs));
    } catch(e) {
      console.warn('localStorage save failed:', e);
      alert('Storage full — try removing some photos.');
    }
  }

  // ── Resize image to thumbnail before storing ──
  function resizeImage(dataUrl, maxWidth, callback) {
    var img = new Image();
    img.onload = function() {
      var w = img.width;
      var h = img.height;
      if (w > maxWidth) {
        h = Math.round(h * maxWidth / w);
        w = maxWidth;
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = function() { callback(dataUrl); };
    img.src = dataUrl;
  }

  // ── Templates ──
  var templates = [];
  var savedTemplates = localStorage.getItem('bf_templates');
  if (savedTemplates) {
    try { templates = JSON.parse(savedTemplates); } catch(e) { /* ignore */ }
  }

  function saveTemplates() {
    try {
      localStorage.setItem('bf_templates', JSON.stringify(templates));
    } catch(e) {
      console.warn('localStorage save failed:', e);
    }
  }

  function saveAsTemplate(jobId) {
    var job = jobs.find(function(j) { return j.id === jobId; });
    if (!job) return;
    var name = prompt('Template name:', job.type);
    if (!name || !name.trim()) return;

    // Convert tasks to relative day offsets from job start
    var jobStart = parseDate(job.startDate);
    var taskTemplates = job.tasks.map(function(t) {
      return {
        name: t.name,
        owner: t.owner,
        color: t.color,
        startDay: daysBetween(jobStart, parseDate(t.start)),
        endDay: daysBetween(jobStart, parseDate(t.end))
      };
    });

    templates.push({
      id: Date.now(),
      name: name.trim(),
      type: job.type,
      tasks: taskTemplates
    });
    saveTemplates();
    alert('Template "' + name.trim() + '" saved.');
  }

  function deleteTemplate(templateId) {
    templates = templates.filter(function(t) { return t.id !== templateId; });
    saveTemplates();
  }

  function createFromTemplate(template) {
    var name = prompt('Customer Name:');
    if (!name || !name.trim()) return;

    pushUndo();
    var startDate = getMonday(addDays(today, 7));
    var newId = Math.max(0, ...jobs.map(function(j) { return j.id; })) + 1;

    var tasks = template.tasks.map(function(t) {
      return {
        name: t.name,
        owner: t.owner || '',
        start: dateToString(addDays(startDate, t.startDay)),
        end: dateToString(addDays(startDate, t.endDay)),
        status: 'scheduled',
        color: t.color,
        notes: '',
        notesList: []
      };
    });

    var lastDay = Math.max.apply(null, template.tasks.map(function(t) { return t.endDay; }));

    jobs.push({
      id: newId,
      customer: name.trim(),
      type: template.type || template.name,
      status: 'scheduled',
      startDate: dateToString(startDate),
      endDate: dateToString(addDays(startDate, lastDay)),
      tasks: tasks
    });
    saveState();
    renderPortfolio();
  }

  function showTemplateDialog() {
    if (templates.length === 0) {
      alert('No templates saved yet. Open a project and use "Save as Template" first.');
      return;
    }

    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    var listHtml = '';
    for (var i = 0; i < templates.length; i++) {
      var t = templates[i];
      listHtml += '<div class="template-item" data-idx="' + i + '">' +
        '<div class="template-info"><strong>' + t.name + '</strong><span class="template-tasks">' + t.tasks.length + ' tasks</span></div>' +
        '<button class="template-delete" data-tid="' + t.id + '" title="Delete template">×</button>' +
        '</div>';
    }
    overlay.innerHTML =
      '<div class="confirm-box" style="min-width:320px;max-width:400px">' +
        '<div class="confirm-msg">Create from Template</div>' +
        '<div class="template-list">' + listHtml + '</div>' +
        '<div class="confirm-btns" style="margin-top:16px">' +
          '<button class="confirm-btn confirm-cancel" id="tmplCancel">Cancel</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelectorAll('.template-item').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (e.target.classList.contains('template-delete')) return;
        var idx = parseInt(el.dataset.idx);
        document.body.removeChild(overlay);
        createFromTemplate(templates[idx]);
      });
    });

    overlay.querySelectorAll('.template-delete').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var tid = parseInt(btn.dataset.tid);
        deleteTemplate(tid);
        document.body.removeChild(overlay);
        showTemplateDialog();
      });
    });

    overlay.querySelector('#tmplCancel').addEventListener('click', function() {
      document.body.removeChild(overlay);
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  }

  function getSidebarW() {
    return window.innerWidth <= 768 ? 120 : 160;
  }

  // ── Name Helper ──
  function shortName(fullName) {
    var parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return fullName;
    // "Tom & Amy Wilson" → "Tom & Amy W."
    // "John Smith" → "John S."
    var last = parts[parts.length - 1];
    var rest = parts.slice(0, -1).join(' ');
    return rest + ' ' + last.charAt(0) + '.';
  }

  // ── Date Helpers ──
  var DAY_MS = 86400000;

  function parseDate(s) { 
    var [y,m,d] = s.split('-').map(Number);
    return new Date(y, m-1, d);
  }

  function formatDate(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / DAY_MS);
  }

  function getMonday(d) {
    var dt = new Date(d);
    var day = dt.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    dt.setDate(dt.getDate() + diff);
    return dt;
  }

  function addDays(d, n) {
    var r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  var MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ── Today ──
  var today = new Date();
  today.setHours(0,0,0,0);

  // ── DOM refs ──
  var $timeline = document.getElementById('timeline');
  var $statsBar = document.getElementById('statsBar');
  var $btnDaily = document.getElementById('btnDaily');
  var $btnTimeline = document.getElementById('btnTimeline');
  var $btnProjects = document.getElementById('btnProjects');
  var $tooltip = document.getElementById('tooltip');
  var $detailPanel = document.getElementById('detailPanel');
  var $detailContent = document.getElementById('detailContent');
  var $timelineContainer = document.getElementById('timelineContainer');
  var $bottomBar = document.getElementById('bottomBar');

  // ── Lightbox ──
  function openLightbox(src) {
    var overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = '<button class="lightbox-close">×</button><img class="lightbox-img" src="' + src + '" />';
    document.body.appendChild(overlay);

    function close() { if (overlay.parentNode) document.body.removeChild(overlay); }
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay || e.target.classList.contains('lightbox-close')) close();
    });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
    });
  }

  // ── Tooltip ──
  function showTooltip(e, html) {
    $tooltip.innerHTML = html;
    $tooltip.classList.add('visible');
    positionTooltip(e);
  }

  function positionTooltip(e) {
    var pad = 12;
    var x = e.clientX + pad;
    var y = e.clientY + pad;
    var rect = $tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - pad;
    $tooltip.style.left = x + 'px';
    $tooltip.style.top = y + 'px';
  }

  function hideTooltip() {
    $tooltip.classList.remove('visible');
  }

  document.addEventListener('mousemove', function(e) {
    if ($tooltip.classList.contains('visible')) positionTooltip(e);
  });

  // ── Render grid lines, month boundaries, and today line into body HTML ──
  function renderGridAndToday(range, dayWidth, sidebarW) {
    var html = '';
    for (var gi = 0; gi < range.totalDays; gi++) {
      var gDay = addDays(range.rangeStart, gi);
      var x = gi * dayWidth + sidebarW;
      var isMon = gDay.getDay() === 1;
      var isWeekend = gDay.getDay() === 0 || gDay.getDay() === 6;
      var isMonthStart = gDay.getDate() === 1;
      if (isWeekend) {
        html += '<div class="grid-line weekend-bg" style="left:' + x + 'px;width:' + dayWidth + 'px"></div>';
      }
      var gridCls = 'grid-line';
      if (isMonthStart) gridCls += ' grid-month';
      else if (isMon) gridCls += ' grid-monday';
      html += '<div class="' + gridCls + '" style="left:' + x + 'px"></div>';
    }
    buildMonthBoundaries(range, dayWidth);
    var todayOffset = daysBetween(range.rangeStart, today);
    if (todayOffset >= 0 && todayOffset < range.totalDays) {
      var tx = todayOffset * dayWidth + sidebarW;
      html += '<div class="today-col" style="left:' + tx + 'px;width:' + dayWidth + 'px"></div>';
    }
    return html;
  }

  // ── Build 3-layer project header: Month → Mon/Fri labels → Day ticks ──
  function buildHeader(range, dayWidth) {
    var { rangeStart, totalDays } = range;
    var trackWidth = totalDays * dayWidth;

    // Layer 1: Months
    var months = [];
    var d = new Date(rangeStart);
    while (d < addDays(rangeStart, totalDays)) {
      var monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      var visEnd = monthEnd > addDays(rangeStart, totalDays) ? addDays(rangeStart, totalDays) : monthEnd;
      var days = daysBetween(d, visEnd) + 1;
      months.push({ label: MONTH_FULL[d.getMonth()] + ' ' + d.getFullYear(), days: days });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }

    // Layer 2: Mon/Fri positioned absolutely over their exact day
    var monFriMarkers = [];
    for (var i = 0; i < totalDays; i++) {
      var dd = addDays(rangeStart, i);
      var dow = dd.getDay();

      if (dow === 1) {
        monFriMarkers.push({ label: 'Mon ' + dd.getDate(), dayIndex: i });
      } else if (dow === 5) {
        monFriMarkers.push({ label: 'Fri ' + dd.getDate(), dayIndex: i });
      }
    }

    var html = '<div class="timeline-header">';
    html += '<div class="timeline-sidebar-header">Projects</div>';
    html += '<div class="timeline-dates" style="width:' + trackWidth + 'px">';

    // Layer 1: Month row (with absolute-positioned dividers for alignment)
    html += '<div class="month-row" style="position:relative">';
    for (var m of months) {
      html += '<div class="month-label" style="width:' + (m.days * dayWidth) + 'px">' + m.label + '</div>';
    }
    // Month divider lines inside header, matching body grid-month positions
    var cumDays = 0;
    for (var mi = 0; mi < months.length; mi++) {
      if (mi > 0) {
        html += '<div class="header-month-divider" style="left:' + (cumDays * dayWidth) + 'px"></div>';
      }
      cumDays += months[mi].days;
    }
    html += '</div>';

    // Layer 2: Mon/Fri label row (positioned at exact day columns)
    html += '<div class="mf-row" style="position:relative;height:20px;">';
    for (var mf of monFriMarkers) {
      var left = mf.dayIndex * dayWidth;
      html += '<div class="mf-label" style="left:' + left + 'px">' + mf.label + '</div>';
    }
    html += '</div>';

    html += '</div></div>';
    return { html, trackWidth };
  }

  // ── Build daily header (for task-level view) ──
  function buildHeaderDaily(range, dayWidth, sidebarLabel) {
    sidebarLabel = sidebarLabel || 'Tasks';
    var { rangeStart, totalDays } = range;
    var trackWidth = totalDays * dayWidth;

    // Collect months
    var months = [];
    var d = new Date(rangeStart);
    while (d < addDays(rangeStart, totalDays)) {
      var monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      var visEnd = monthEnd > addDays(rangeStart, totalDays) ? addDays(rangeStart, totalDays) : monthEnd;
      var days = daysBetween(d, visEnd) + 1;
      months.push({ label: MONTH_FULL[d.getMonth()] + ' ' + d.getFullYear(), days: days });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }

    // Individual days
    var dayLabels = [];
    var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (var i = 0; i < totalDays; i++) {
      var dd = addDays(rangeStart, i);
      var isWeekend = dd.getDay() === 0 || dd.getDay() === 6;
      dayLabels.push({
        label: DOW[dd.getDay()] + ' ' + dd.getDate(),
        isWeekend: isWeekend,
        isToday: dd.getTime() === today.getTime()
      });
    }

    var html = '<div class="timeline-header">';
    html += '<div class="timeline-sidebar-header">' + sidebarLabel + '</div>';
    html += '<div class="timeline-dates" style="width:' + trackWidth + 'px">';

    // Month row (with aligned dividers)
    html += '<div class="month-row" style="position:relative">';
    for (var m of months) {
      html += '<div class="month-label" style="width:' + (m.days * dayWidth) + 'px">' + m.label + '</div>';
    }
    var cumDays2 = 0;
    for (var mi2 = 0; mi2 < months.length; mi2++) {
      if (mi2 > 0) {
        html += '<div class="header-month-divider" style="left:' + (cumDays2 * dayWidth) + 'px"></div>';
      }
      cumDays2 += months[mi2].days;
    }
    html += '</div>';

    // Day row
    html += '<div class="day-row">';
    for (var dl of dayLabels) {
      var cls = 'day-label';
      if (dl.isWeekend) cls += ' weekend';
      if (dl.isToday) cls += ' today-label';
      html += '<div class="' + cls + '" style="width:' + dayWidth + 'px">' + dl.label + '</div>';
    }
    html += '</div>';

    html += '</div></div>';
    return { html, trackWidth };
  }

  // ── Progress for a job ──
  function jobProgress(job) {
    if (!job.tasks.length) return 0;
    var done = job.tasks.filter(function(t) { return t.status === 'complete'; }).length;
    return Math.round((done / job.tasks.length) * 100);
  }

  // ── Render Level 1: Timeline ──
  // ── Weekend overlay helper ──
  function weekendOverlaysHtml(startDate, endDate, dayWidth) {
    var html = '';
    var d = new Date(startDate);
    var barStart = new Date(startDate);
    while (d <= endDate) {
      var dow = d.getDay();
      if (dow === 0 || dow === 6) {
        var offsetDays = daysBetween(barStart, d);
        var left = offsetDays * dayWidth;
        html += '<div class="bar-weekend" style="left:' + left + 'px;width:' + dayWidth + 'px"><div class="bar-weekend-stripe"></div></div>';
      }
      d = addDays(d, 1);
    }
    return html;
  }

  // ── Floating month label ──
  var $floatingMonth = document.getElementById('floatingMonth');
  var monthBoundaries = []; // [{x: px from content left, label: 'February 2026'}, ...]

  function buildMonthBoundaries(range, dayWidth) {
    var boundaries = [];
    var d = new Date(range.rangeStart);
    while (d < addDays(range.rangeStart, range.totalDays)) {
      var monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      var visEnd = monthEnd > addDays(range.rangeStart, range.totalDays) ? addDays(range.rangeStart, range.totalDays) : monthEnd;
      var daysInView = daysBetween(d, visEnd) + 1;
      var xStart = daysBetween(range.rangeStart, d) * dayWidth;
      boundaries.push({
        xStart: xStart,
        xEnd: xStart + daysInView * dayWidth,
        label: MONTH_FULL[d.getMonth()] + ' ' + d.getFullYear()
      });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    monthBoundaries = boundaries;
  }

  function updateFloatingMonth() {
    if (!monthBoundaries.length) { $floatingMonth.style.opacity = '0'; return; }
    var scrollLeft = $timelineContainer.scrollLeft;
    var sidebarW = getSidebarW();
    var viewCenter = scrollLeft + $timelineContainer.clientWidth / 2 - sidebarW;

    var current = monthBoundaries[0];
    for (var i = 0; i < monthBoundaries.length; i++) {
      if (viewCenter >= monthBoundaries[i].xStart) {
        current = monthBoundaries[i];
      }
    }
    $floatingMonth.textContent = current.label;
    $floatingMonth.style.opacity = '1';
  }

  $timelineContainer.addEventListener('scroll', updateFloatingMonth);

  // ── Scroll position preservation ──
  var savedScrollLeft = null;

  function saveScrollPos() {
    savedScrollLeft = $timelineContainer.scrollLeft;
  }

  function restoreScrollPos() {
    if (savedScrollLeft !== null) {
      $timelineContainer.scrollLeft = savedScrollLeft;
      savedScrollLeft = null;
    }
  }

  // ── Infinite scroll state ──
  var infiniteState = null;
  var scrollHandler = null;

  function detachInfiniteScroll() {
    if (scrollHandler) {
      $timelineContainer.removeEventListener('scroll', scrollHandler);
      scrollHandler = null;
    }
    infiniteState = null;
  }

  function attachInfiniteScroll(renderFn, dayWidth) {
    var expandLock = false;
    scrollHandler = function() {
      if (expandLock || !infiniteState) return;
      var el = $timelineContainer;
      var threshold = 200;
      var scrollRight = el.scrollWidth - el.scrollLeft - el.clientWidth;

      if (scrollRight < threshold) {
        expandLock = true;
        expandTimeline('right', dayWidth, renderFn);
        setTimeout(function() { expandLock = false; }, 100);
      } else if (el.scrollLeft < threshold) {
        expandLock = true;
        expandTimeline('left', dayWidth, renderFn);
        setTimeout(function() { expandLock = false; }, 100);
      }
    };
    $timelineContainer.addEventListener('scroll', scrollHandler);
  }

  function expandTimeline(direction, dayWidth, renderFn) {
    if (!infiniteState) return;
    var oldScrollLeft = $timelineContainer.scrollLeft;
    var expandDays = 91; // ~3 months

    if (direction === 'right') {
      infiniteState.totalDays += expandDays;
      infiniteState.rangeEnd = addDays(infiniteState.rangeStart, infiniteState.totalDays);
    } else {
      var newStart = addDays(infiniteState.rangeStart, -expandDays);
      newStart = getMonday(newStart);
      var addedDays = daysBetween(newStart, infiniteState.rangeStart);
      infiniteState.rangeStart = newStart;
      infiniteState.totalDays += addedDays;
      infiniteState.rangeEnd = addDays(infiniteState.rangeStart, infiniteState.totalDays);
    }

    renderFn(infiniteState, false); // re-render without scroll-to-today

    if (direction === 'left') {
      var addedPx = daysBetween(infiniteState.rangeStart, addDays(infiniteState.rangeStart, expandDays)) * dayWidth;
      // Actually compute added days precisely
      $timelineContainer.scrollLeft = oldScrollLeft + expandDays * dayWidth;
    }
  }

  function renderPortfolio(existingRange, doScroll) {
    currentLevel = 1;
    currentJobId = null;
    currentTaskIndex = null;
    $detailPanel.classList.remove('visible');
    $bottomBar.style.display = 'none';

    // Stats
    var active = jobs.filter(function(j) { return j.status === 'active'; }).length;
    var scheduled = jobs.filter(function(j) { return j.status === 'scheduled'; }).length;
    var completed = jobs.filter(function(j) { return j.status === 'completed'; }).length;
    $statsBar.innerHTML =
      '<div class="stat"><strong>' + active + '</strong> Active</div>' +
      '<div class="stat"><strong>' + scheduled + '</strong> Scheduled</div>' +
      '<div class="stat"><strong>' + completed + '</strong> Completed</div>' +
      '<div class="stat"><strong>' + jobs.length + '</strong> Total Jobs</div>';

    updateToggle();

    var range;
    if (existingRange) {
      range = existingRange;
    } else {
      // Initial: 6 months back, 6 months forward
      detachInfiniteScroll();
      var rangeStart = getMonday(addDays(today, -182));
      var totalDays = 365;
      range = { rangeStart: rangeStart, rangeEnd: addDays(rangeStart, totalDays), totalDays: totalDays };
    }
    infiniteState = range;

    // Dynamic dayWidth to show ~90 days
    var sidebarW_tl = getSidebarW();
    var containerWidth_tl = $timelineContainer.clientWidth || window.innerWidth;
    var dayWidth = Math.floor((containerWidth_tl - sidebarW_tl) / 90);
    if (dayWidth < 4) dayWidth = 4;
    var { html: headerHtml, trackWidth } = buildHeader(range, dayWidth);

    // Body rows
    var sorted = jobs.slice().sort(function(a, b) { return parseDate(a.startDate) - parseDate(b.startDate); });
    var bodyHtml = '<div class="timeline-body" style="position:relative">';

    bodyHtml += renderGridAndToday(range, dayWidth, getSidebarW());

    for (var i = 0; i < sorted.length; i++) {
      var job = sorted[i];
      var jobColor = JOB_COLORS[job.id % JOB_COLORS.length];
      var start = parseDate(job.startDate);
      var end = parseDate(job.endDate);
      var leftDays = daysBetween(range.rangeStart, start);
      var widthDays = daysBetween(start, end) + 1;
      var pct = jobProgress(job);
      var barClass = job.status === 'completed' ? ' completed-bar' : '';

      bodyHtml += '<div class="timeline-row">';
      bodyHtml += '<div class="row-label" data-job="' + job.id + '">';
      bodyHtml += '<span class="status-dot ' + job.status + '"></span>';
      bodyHtml += '<span class="job-name stacked"><span class="line1">' + shortName(job.customer) + '</span><span class="line2">' + job.type + '</span></span>';
      bodyHtml += '<button class="row-label-delete" data-deletejob="' + job.id + '" title="Delete project">×</button>';
      bodyHtml += '</div>';
      bodyHtml += '<div class="row-track">';
      bodyHtml += '<div class="bar' + barClass + '" data-job="' + job.id + '" data-type="job" style="left:' + (leftDays * dayWidth) + 'px;width:' + (widthDays * dayWidth - 2) + 'px;background:' + jobColor + '">';
      bodyHtml += weekendOverlaysHtml(start, end, dayWidth);
      bodyHtml += '<div class="drag-handle drag-handle-left" data-side="left"></div>';
      bodyHtml += '<span class="bar-label">' + job.customer + ' (' + pct + '%)</span>';
      bodyHtml += '<div class="drag-handle drag-handle-right" data-side="right"></div>';
      bodyHtml += '</div>';
      bodyHtml += '</div></div>';
    }

    bodyHtml += '</div>';

    $timeline.innerHTML = headerHtml + bodyHtml;
    $timeline.style.width = (trackWidth + getSidebarW()) + 'px';

    if (!existingRange) {
      $timeline.classList.add('view-enter');
      setTimeout(function() { $timeline.classList.remove('view-enter'); }, 300);
    }

    // Delete project from row label
    $timeline.querySelectorAll('.row-label-delete[data-deletejob]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var jid = parseInt(btn.dataset.deletejob);
        deleteProject(jid);
      });
    });

    // Bind events: click navigates to daily view for that project
    $timeline.querySelectorAll('.bar[data-job], .row-label[data-job]').forEach(function(el) {
      el.addEventListener('click', function() {
        if (Date.now() - lastDragEnd < 300) return;
        var jid = parseInt(el.dataset.job);
        renderDaily(jid);
      });
    });

    // Tooltips on bars
    $timeline.querySelectorAll('.bar[data-job]').forEach(function(el) {
      var job = jobs.find(function(j) { return j.id === parseInt(el.dataset.job); });
      el.addEventListener('mouseenter', function(e) {
        var pct = jobProgress(job);
        showTooltip(e,
          '<div class="tooltip-title">' + job.customer + ' — ' + job.type + '</div>' +
          '<div class="tooltip-row"><strong>Start:</strong> ' + formatDate(parseDate(job.startDate)) + '</div>' +
          '<div class="tooltip-row"><strong>End:</strong> ' + formatDate(parseDate(job.endDate)) + '</div>' +
          '<div class="tooltip-row"><strong>Progress:</strong> ' + pct + '%</div>' +
          '<div class="tooltip-row"><strong>Status:</strong> ' + job.status + '</div>'
        );
      });
      el.addEventListener('mouseleave', hideTooltip);
    });

    // Attach infinite scroll
    if (!existingRange) {
      attachInfiniteScroll(function(r) { renderPortfolio(r, false); }, dayWidth);
    }

    // Scroll to today on first render
    if (doScroll !== false && !existingRange) {
      scrollToToday(range, dayWidth, getSidebarW());
    }
    setTimeout(updateFloatingMonth, 50);
  }

  // ── Render Level 2: Projects (shows project bars, 30-day visible window) ──
  function renderProject(jobId, existingRange, doScroll) {
    currentLevel = 2;
    currentJobId = null;
    currentTaskIndex = null;
    $detailPanel.classList.remove('visible');
    $bottomBar.style.display = 'none';

    // Stats
    var active = jobs.filter(function(j) { return j.status === 'active'; }).length;
    var scheduled = jobs.filter(function(j) { return j.status === 'scheduled'; }).length;
    var completed = jobs.filter(function(j) { return j.status === 'completed'; }).length;
    $statsBar.innerHTML =
      '<div class="stat"><strong>' + active + '</strong> Active</div>' +
      '<div class="stat"><strong>' + scheduled + '</strong> Scheduled</div>' +
      '<div class="stat"><strong>' + completed + '</strong> Completed</div>' +
      '<div class="stat"><strong>' + jobs.length + '</strong> Total Jobs</div>';

    updateToggle();

    var range;
    if (existingRange) {
      range = existingRange;
    } else {
      detachInfiniteScroll();
      var rangeStart = getMonday(addDays(today, -60));
      var totalDays = 120;
      range = { rangeStart: rangeStart, rangeEnd: addDays(rangeStart, totalDays), totalDays: totalDays };
    }
    infiniteState = range;

    // Dynamic dayWidth to show ~30 days
    var sidebarW = getSidebarW();
    var containerWidth = $timelineContainer.clientWidth || window.innerWidth;
    var dayWidth = Math.floor((containerWidth - sidebarW) / 30);
    if (dayWidth < 14) dayWidth = 14;

    var headerResult = buildHeaderDaily(range, dayWidth, 'Projects');
    var headerHtml = headerResult.html;
    var trackWidth = headerResult.trackWidth;

    var sorted = jobs.slice().sort(function(a, b) { return parseDate(a.startDate) - parseDate(b.startDate); });
    var bodyHtml = '<div class="timeline-body" style="position:relative">';

    bodyHtml += renderGridAndToday(range, dayWidth, sidebarW);

    for (var i = 0; i < sorted.length; i++) {
      var job = sorted[i];
      var jobColor = JOB_COLORS[job.id % JOB_COLORS.length];
      var start = parseDate(job.startDate);
      var end = parseDate(job.endDate);
      var leftDays = daysBetween(range.rangeStart, start);
      var widthDays = daysBetween(start, end) + 1;
      var pct = jobProgress(job);
      var barClass = job.status === 'completed' ? ' completed-bar' : '';

      bodyHtml += '<div class="timeline-row">';
      bodyHtml += '<div class="row-label" data-job="' + job.id + '">';
      bodyHtml += '<span class="status-dot ' + job.status + '"></span>';
      bodyHtml += '<span class="job-name stacked"><span class="line1">' + shortName(job.customer) + '</span><span class="line2">' + job.type + '</span></span>';
      bodyHtml += '<button class="row-label-delete" data-deletejob="' + job.id + '" title="Delete project">×</button>';
      bodyHtml += '</div>';
      bodyHtml += '<div class="row-track">';
      bodyHtml += '<div class="bar' + barClass + '" data-job="' + job.id + '" data-type="job" style="left:' + (leftDays * dayWidth) + 'px;width:' + (widthDays * dayWidth - 2) + 'px;background:' + jobColor + '">';
      bodyHtml += weekendOverlaysHtml(start, end, dayWidth);
      bodyHtml += '<div class="drag-handle drag-handle-left" data-side="left"></div>';
      bodyHtml += '<span class="bar-label">' + job.customer + ' (' + pct + '%)</span>';
      bodyHtml += '<div class="drag-handle drag-handle-right" data-side="right"></div>';
      bodyHtml += '</div>';
      bodyHtml += '</div></div>';
    }

    bodyHtml += '</div>';

    $timeline.innerHTML = headerHtml + bodyHtml;
    $timeline.style.width = (trackWidth + sidebarW) + 'px';

    if (!existingRange) {
      $timeline.classList.add('view-enter');
      setTimeout(function() { $timeline.classList.remove('view-enter'); }, 300);
    }

    // Delete project from row label
    $timeline.querySelectorAll('.row-label-delete[data-deletejob]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var jid = parseInt(btn.dataset.deletejob);
        deleteProject(jid);
      });
    });

    // Click navigates to Daily view for that project
    $timeline.querySelectorAll('.bar[data-job], .row-label[data-job]').forEach(function(el) {
      el.addEventListener('click', function() {
        if (Date.now() - lastDragEnd < 300) return;
        var jid = parseInt(el.dataset.job);
        renderDaily(jid);
      });
    });

    // Tooltips
    $timeline.querySelectorAll('.bar[data-job]').forEach(function(el) {
      var job = jobs.find(function(j) { return j.id === parseInt(el.dataset.job); });
      el.addEventListener('mouseenter', function(e) {
        var pct = jobProgress(job);
        showTooltip(e,
          '<div class="tooltip-title">' + job.customer + ' — ' + job.type + '</div>' +
          '<div class="tooltip-row"><strong>Start:</strong> ' + formatDate(parseDate(job.startDate)) + '</div>' +
          '<div class="tooltip-row"><strong>End:</strong> ' + formatDate(parseDate(job.endDate)) + '</div>' +
          '<div class="tooltip-row"><strong>Progress:</strong> ' + pct + '%</div>' +
          '<div class="tooltip-row"><strong>Status:</strong> ' + job.status + '</div>'
        );
      });
      el.addEventListener('mouseleave', hideTooltip);
    });

    if (!existingRange) {
      attachInfiniteScroll(function(r) { renderProject(null, r, false); }, dayWidth);
    }

    if (savedScrollLeft !== null) {
      restoreScrollPos();
    } else if (doScroll !== false && !existingRange) {
      scrollToToday(range, dayWidth, sidebarW);
    }
    setTimeout(updateFloatingMonth, 50);
  }

  // ── Pick next unused phase color ──
  function nextColor(usedColors) {
    var allColors = Object.keys(PHASE_COLORS);
    for (var c of allColors) {
      if (!usedColors.includes(c)) return c;
    }
    return 'other'; // all used, fallback
  }

  // ── Render Materials + Photos (sticky bottom bar) ──
  function renderMaterials(job) {
    if (!job.materials) job.materials = [];
    if (!job.photos) job.photos = [];
    $bottomBar.style.display = 'flex';

    // Restore structure if it was replaced by prompt
    if (!document.getElementById('materialsList')) {
      $bottomBar.innerHTML =
        '<div class="bottom-panel materials-section" id="materialsSection">' +
          '<div class="bottom-panel-header"><h3>Materials</h3></div>' +
          '<div class="materials-list" id="materialsList"></div>' +
          '<div class="materials-add">' +
            '<input type="text" id="newMaterialInput" class="material-input" placeholder="Add material..." />' +
            '<button id="addMaterialBtn" class="material-add-btn">+ Add</button>' +
          '</div>' +
        '</div>' +
        '<div class="bottom-panel notes-section" id="notesSection">' +
          '<div class="bottom-panel-header"><h3>Notes</h3></div>' +
          '<div class="notes-list" id="notesList"></div>' +
          '<div class="notes-add">' +
            '<textarea id="newNoteInput" class="note-input" placeholder="Add a note..." rows="2"></textarea>' +
            '<button id="addNoteBtn" class="note-add-btn">+ Add</button>' +
          '</div>' +
        '</div>' +
        '<div class="bottom-panel photos-section" id="photosSection">' +
          '<div class="bottom-panel-header"><h3>Photos</h3></div>' +
          '<div class="photos-grid" id="photosGrid"></div>' +
          '<label class="photo-upload-btn" id="photoUploadLabel">' +
            '<input type="file" id="photoUploadInput" accept="image/*" multiple style="display:none;" />' +
            '+ Add Photos' +
          '</label>' +
        '</div>';
    }

    var matList = document.getElementById('materialsList');
    var photGrid = document.getElementById('photosGrid');

    var html = '';
    for (var mi = 0; mi < job.materials.length; mi++) {
      var mat = job.materials[mi];
      html += '<div class="material-item" data-index="' + mi + '">';
      html += '<input type="checkbox" class="material-check" ' + (mat.done ? 'checked' : '') + ' data-mi="' + mi + '">';
      html += '<span class="material-text' + (mat.done ? ' done' : '') + '">' + mat.text + '</span>';
      html += '<button class="material-delete" data-mi="' + mi + '">×</button>';
      html += '</div>';
    }
    matList.innerHTML = html;

    // Rebind events
    var matInput = document.getElementById('newMaterialInput');
    var matAddBtn = document.getElementById('addMaterialBtn');

    // Clone to remove old listeners
    var newAddBtn = matAddBtn.cloneNode(true);
    matAddBtn.parentNode.replaceChild(newAddBtn, matAddBtn);
    var newInput = matInput.cloneNode(true);
    matInput.parentNode.replaceChild(newInput, matInput);

    newAddBtn.addEventListener('click', function() {
      var text = newInput.value.trim();
      if (!text) return;
      pushUndo();
      job.materials.push({ text: text, done: false });
      newInput.value = '';
      saveState();
      renderMaterials(job);
    });
    newInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') newAddBtn.click();
    });

    matList.querySelectorAll('.material-check').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var mi = parseInt(this.dataset.mi);
        job.materials[mi].done = this.checked;
        saveState();
        renderMaterials(job);
      });
    });
    matList.querySelectorAll('.material-delete').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var mi = parseInt(this.dataset.mi);
        job.materials.splice(mi, 1);
        saveState();
        renderMaterials(job);
      });
    });

    // Notes (list-based)
    if (!job.notesList) job.notesList = [];
    var $notesList = document.getElementById('notesList');
    var notesHtml = '';
    for (var ni = 0; ni < job.notesList.length; ni++) {
      var note = job.notesList[ni];
      var timeStr = note.time ? new Date(note.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      notesHtml += '<div class="note-item" data-ni="' + ni + '">';
      notesHtml += '<div style="flex:1"><div class="note-text" data-ni="' + ni + '">' + note.text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
      if (timeStr) notesHtml += '<div class="note-time">' + timeStr + '</div>';
      notesHtml += '</div>';
      notesHtml += '<button class="note-edit" data-ni="' + ni + '" title="Edit">✎</button>';
      notesHtml += '<button class="note-delete" data-ni="' + ni + '">×</button>';
      notesHtml += '</div>';
    }
    $notesList.innerHTML = notesHtml;

    // Note edit (click text or edit icon)
    function startNoteEdit(ni) {
      var noteItem = $notesList.querySelector('.note-item[data-ni="' + ni + '"]');
      var noteTextEl = noteItem.querySelector('.note-text');
      var currentText = job.notesList[ni].text;
      var textarea = document.createElement('textarea');
      textarea.className = 'note-edit-area';
      textarea.value = currentText;
      noteTextEl.replaceWith(textarea);
      textarea.focus();
      function saveEdit() {
        var newText = textarea.value.trim();
        if (newText && newText !== currentText) {
          pushUndo();
          job.notesList[ni].text = newText;
          saveState();
        }
        renderMaterials(job);
      }
      textarea.addEventListener('blur', saveEdit);
      textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
      });
    }
    $notesList.querySelectorAll('.note-text').forEach(function(el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function() { startNoteEdit(parseInt(el.dataset.ni)); });
    });
    $notesList.querySelectorAll('.note-edit').forEach(function(btn) {
      btn.addEventListener('click', function() { startNoteEdit(parseInt(btn.dataset.ni)); });
    });

    // Note add
    var noteInput = document.getElementById('newNoteInput');
    var noteAddBtn = document.getElementById('addNoteBtn');
    var newNoteBtn = noteAddBtn.cloneNode(true);
    noteAddBtn.parentNode.replaceChild(newNoteBtn, noteAddBtn);
    var newNoteInput = noteInput.cloneNode(true);
    noteInput.parentNode.replaceChild(newNoteInput, noteInput);

    newNoteBtn.addEventListener('click', function() {
      var text = newNoteInput.value.trim();
      if (!text) return;
      pushUndo();
      job.notesList.push({ text: text, time: Date.now() });
      newNoteInput.value = '';
      saveState();
      renderMaterials(job);
    });
    newNoteInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        newNoteBtn.click();
      }
    });

    // Note delete
    $notesList.querySelectorAll('.note-delete').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var ni = parseInt(this.dataset.ni);
        job.notesList.splice(ni, 1);
        saveState();
        renderMaterials(job);
      });
    });

    // Photos
    var photosHtml = '';
    for (var pi = 0; pi < job.photos.length; pi++) {
      photosHtml += '<div class="photo-wrapper" data-pi="' + pi + '">';
      photosHtml += '<img class="photo-thumb" src="' + job.photos[pi] + '" />';
      photosHtml += '<button class="photo-remove" data-pi="' + pi + '">×</button>';
      photosHtml += '</div>';
    }
    photGrid.innerHTML = photosHtml;

    // Photo upload — fresh input each render to avoid stale refs
    var uploadLabel = document.getElementById('photoUploadLabel');
    if (uploadLabel) {
      var freshInput = document.createElement('input');
      freshInput.type = 'file';
      freshInput.id = 'photoUploadInput';
      freshInput.accept = 'image/*';
      freshInput.multiple = true;
      freshInput.style.display = 'none';
      // Remove old input, insert fresh one
      var oldInput = uploadLabel.querySelector('input');
      if (oldInput) uploadLabel.removeChild(oldInput);
      uploadLabel.insertBefore(freshInput, uploadLabel.firstChild);

      freshInput.addEventListener('change', function() {
        var files = Array.from(this.files);
        var pending = files.length;
        if (!pending) return;
        files.forEach(function(file) {
          var reader = new FileReader();
          reader.onload = function(e) {
            resizeImage(e.target.result, 400, function(thumb) {
              job.photos.push(thumb);
              pending--;
              if (pending <= 0) {
                saveState();
                renderMaterials(job);
              }
            });
          };
          reader.readAsDataURL(file);
        });
      });
    }

    // Photo lightbox
    photGrid.querySelectorAll('.photo-thumb').forEach(function(img) {
      img.addEventListener('click', function() {
        openLightbox(this.src);
      });
    });

    // Photo remove
    photGrid.querySelectorAll('.photo-remove').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var pi = parseInt(this.dataset.pi);
        job.photos.splice(pi, 1);
        saveState();
        renderMaterials(job);
      });
    });
  }

  // ── Auto-stagger: sort tasks by start date, update job date range ──
  function autoStaggerTasks(job) {
    job.tasks.sort(function(a, b) {
      return parseDate(a.start) - parseDate(b.start);
    });
    if (job.tasks.length > 0) {
      var allStarts = job.tasks.map(function(t) { return parseDate(t.start); });
      var allEnds = job.tasks.map(function(t) { return parseDate(t.end); });
      job.startDate = dateToString(new Date(Math.min.apply(null, allStarts)));
      job.endDate = dateToString(new Date(Math.max.apply(null, allEnds)));
    }
    saveState();
  }

  // ── Delete a project ──
  function deleteProject(jobId) {
    showConfirmDialog('Delete this entire project?', function(confirmed) {
      if (!confirmed) return;
      pushUndo();
      jobs = jobs.filter(function(j) { return j.id !== jobId; });
      saveState();
      $detailPanel.classList.remove('visible');
      renderPortfolio();
    });
  }

  // ── Delete a task ──
  function deleteTask(jobId, taskIndex) {
    showConfirmDialog('Delete this task?', function(confirmed) {
      if (!confirmed) return;
      pushUndo();
      var job = jobs.find(function(j) { return j.id === jobId; });
      if (!job) return;
      job.tasks.splice(taskIndex, 1);
      autoStaggerTasks(job);
      $detailPanel.classList.remove('visible');
      if (currentLevel === 0) renderDaily(jobId);
      else renderProject(jobId);
    });
  }

  // ── Render Level 3: Task Detail (fully editable) ──
  function renderTaskDetail(jobId, taskIndex) {
    // Save scroll before any re-render
    if (currentLevel !== 3) saveScrollPos();
    currentLevel = 3;
    currentJobId = jobId;
    currentTaskIndex = taskIndex;

    var job = jobs.find(function(j) { return j.id === jobId; });
    if (!job) return renderPortfolio();
    var task = job.tasks[taskIndex];
    if (!task) return renderProject(jobId);

    updateToggle();

    // Show detail panel
    $detailPanel.classList.add('visible');

    var color = PHASE_COLORS[task.color] || PHASE_COLORS.other;
    var dur = daysBetween(parseDate(task.start), parseDate(task.end)) + 1;

    // Build color picker options
    var colorOptionsHtml = '';
    var colorKeys = Object.keys(PHASE_COLORS);
    for (var ci = 0; ci < colorKeys.length; ci++) {
      var ck = colorKeys[ci];
      var sel = task.color === ck ? ' selected' : '';
      colorOptionsHtml += '<div class="color-option' + sel + '" data-color="' + ck + '" style="background:' + PHASE_COLORS[ck] + '" title="' + ck + '"></div>';
    }

    $detailContent.innerHTML =
      '<h2><span class="color-swatch" style="background:' + color + '"></span>' + task.name + '</h2>' +
      '<div class="detail-group">' +
        '<div class="detail-field"><label>Task Name</label>' +
          '<input type="text" id="taskNameInput" value="' + task.name.replace(/"/g, '&quot;') + '" />' +
        '</div>' +
        '<div class="detail-field"><label>Owner / Assigned</label>' +
          '<input type="text" id="taskOwnerInput" value="' + (task.owner || '').replace(/"/g, '&quot;') + '" placeholder="e.g. Crew A, Mike (Sub)" />' +
        '</div>' +
        '<div class="detail-field"><label>Status</label>' +
          '<select id="taskStatus">' +
            '<option value="scheduled"' + (task.status === 'scheduled' ? ' selected' : '') + '>Scheduled</option>' +
            '<option value="active"' + (task.status === 'active' ? ' selected' : '') + '>In Progress</option>' +
            '<option value="complete"' + (task.status === 'complete' ? ' selected' : '') + '>Complete</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="detail-group">' +
        '<div class="detail-field"><label>Start Date</label>' +
          '<input type="date" id="taskStartInput" value="' + task.start + '" />' +
        '</div>' +
        '<div class="detail-field"><label>End Date</label>' +
          '<input type="date" id="taskEndInput" value="' + task.end + '" />' +
        '</div>' +
        '<div class="detail-field"><label>Duration</label><div class="value" id="taskDuration">' + dur + ' day' + (dur > 1 ? 's' : '') + '</div></div>' +
      '</div>' +
      '<div class="detail-group">' +
        '<div class="detail-field"><label>Phase Color</label>' +
          '<div class="color-options" id="colorOptions">' + colorOptionsHtml + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="detail-group">' +
        '<div class="detail-field"><label>Notes</label>' +
          '<div class="task-notes-list" id="taskNotesList"></div>' +
          '<div class="notes-add">' +
            '<textarea id="taskNoteInput" class="note-input" placeholder="Add a note..." rows="2"></textarea>' +
            '<button id="taskNoteAddBtn" class="note-add-btn">+ Add</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="detail-group">' +
        '<button class="delete-btn" id="deleteTaskBtn">Delete Task</button>' +
      '</div>';

    // ── Bind editable fields ──
    function applyFieldChanges() {
      pushUndo();
      saveScrollPos();
      var newName = document.getElementById('taskNameInput').value.trim();
      var newOwner = document.getElementById('taskOwnerInput').value.trim();
      var newStatus = document.getElementById('taskStatus').value;
      var newStart = document.getElementById('taskStartInput').value;
      var newEnd = document.getElementById('taskEndInput').value;

      if (newName) task.name = newName;
      task.owner = newOwner;
      task.status = newStatus;

      if (newStart && newEnd && parseDate(newStart) <= parseDate(newEnd)) {
        task.start = newStart;
        task.end = newEnd;
      }

      // Update job status
      var allComplete = job.tasks.every(function(t) { return t.status === 'complete'; });
      var anyActive = job.tasks.some(function(t) { return t.status === 'active'; });
      if (allComplete) job.status = 'completed';
      else if (anyActive) job.status = 'active';
      else job.status = 'scheduled';

      autoStaggerTasks(job);
      renderProject(jobId);

      // Update duration display
      var durEl = document.getElementById('taskDuration');
      if (durEl) {
        var d = daysBetween(parseDate(task.start), parseDate(task.end)) + 1;
        durEl.textContent = d + ' day' + (d > 1 ? 's' : '');
      }
    }

    // Save on change/blur for all inputs
    ['taskNameInput', 'taskOwnerInput'].forEach(function(id) {
      var el = document.getElementById(id);
      el.addEventListener('change', applyFieldChanges);
    });
    document.getElementById('taskStatus').addEventListener('change', applyFieldChanges);
    ['taskStartInput', 'taskEndInput'].forEach(function(id) {
      var el = document.getElementById(id);
      el.addEventListener('change', applyFieldChanges);
    });

    // Color picker
    document.getElementById('colorOptions').addEventListener('click', function(e) {
      var opt = e.target.closest('.color-option');
      if (!opt) return;
      task.color = opt.dataset.color;
      // Update selection
      this.querySelectorAll('.color-option').forEach(function(o) { o.classList.remove('selected'); });
      opt.classList.add('selected');
      saveState();
      renderProject(jobId);
      // Find updated task index after possible re-sort
      var newIdx = job.tasks.indexOf(task);
      if (newIdx >= 0) renderTaskDetail(jobId, newIdx);
    });

    // Delete task
    document.getElementById('deleteTaskBtn').addEventListener('click', function() {
      deleteTask(jobId, taskIndex);
    });

    // Task notes (list-based)
    if (!task.notesList) task.notesList = [];
    var $taskNotesList = document.getElementById('taskNotesList');
    function renderTaskNotes() {
      var nh = '';
      for (var ni = 0; ni < task.notesList.length; ni++) {
        var note = task.notesList[ni];
        var timeStr = note.time ? new Date(note.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
        nh += '<div class="note-item" data-ni="' + ni + '">';
        nh += '<div style="flex:1"><div class="note-text">' + note.text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
        if (timeStr) nh += '<div class="note-time">' + timeStr + '</div>';
        nh += '</div>';
        nh += '<button class="note-delete" data-ni="' + ni + '">×</button>';
        nh += '</div>';
      }
      $taskNotesList.innerHTML = nh;
      $taskNotesList.querySelectorAll('.note-delete').forEach(function(btn) {
        btn.addEventListener('click', function() {
          task.notesList.splice(parseInt(this.dataset.ni), 1);
          saveState();
          renderTaskNotes();
        });
      });
    }
    renderTaskNotes();

    document.getElementById('taskNoteAddBtn').addEventListener('click', function() {
      var input = document.getElementById('taskNoteInput');
      var text = input.value.trim();
      if (!text) return;
      task.notesList.push({ text: text, time: Date.now() });
      input.value = '';
      saveState();
      renderTaskNotes();
    });
    document.getElementById('taskNoteInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('taskNoteAddBtn').click();
      }
    });
  }

  // ── Render Level 0: Daily (all tasks from all projects) ──
  function renderDaily(jobId, existingRange, doScroll) {
    currentLevel = 0;
    currentTaskIndex = null;
    $detailPanel.classList.remove('visible');

    // If no jobId provided, pick one
    if (!jobId && currentJobId) {
      jobId = currentJobId;
    } else if (!jobId) {
      var active = jobs.find(function(j) { return j.status === 'active'; }) || jobs[0];
      if (active) jobId = active.id;
    }
    currentJobId = jobId;

    var job = jobs.find(function(j) { return j.id === jobId; });
    if (!job) return renderPortfolio();

    // Stats
    var done = job.tasks.filter(function(t) { return t.status === 'complete'; }).length;
    var inProg = job.tasks.filter(function(t) { return t.status === 'active'; }).length;
    var sched = job.tasks.filter(function(t) { return t.status === 'scheduled'; }).length;
    var projectDisplayName = job.customer + ' — ' + job.type;

    $statsBar.innerHTML =
      '<div class="project-title"><span class="status-dot ' + job.status + '"></span><span class="project-name-text">' + projectDisplayName + '</span></div>' +
      '<div class="stat"><strong>' + done + '</strong> Complete</div>' +
      '<div class="stat"><strong>' + inProg + '</strong> In Progress</div>' +
      '<div class="stat"><strong>' + sched + '</strong> Scheduled</div>' +
      '<div class="stat"><strong>' + job.tasks.length + '</strong> Total Tasks</div>';

    updateToggle();

    // Range: tight — 7 days before project start, 7 days after project end
    var range;
    if (existingRange) {
      range = existingRange;
    } else {
      detachInfiniteScroll();
      var start = parseDate(job.startDate);
      var end = parseDate(job.endDate);
      var rangeStart = getMonday(addDays(start, -7));
      var rangeEnd = addDays(end, 7);
      var totalDays = daysBetween(rangeStart, rangeEnd);
      range = { rangeStart: rangeStart, rangeEnd: rangeEnd, totalDays: totalDays };
    }
    infiniteState = range;

    var sidebarW = getSidebarW();
    var containerWidth = $timelineContainer.clientWidth || window.innerWidth;
    var dayWidth = Math.floor((containerWidth - sidebarW) / 7);
    if (dayWidth < 48) dayWidth = 48; // minimum
    var headerResult = buildHeaderDaily(range, dayWidth);
    var headerHtml = headerResult.html;
    var trackWidth = headerResult.trackWidth;

    var bodyHtml = '<div class="timeline-body" style="position:relative">';

    bodyHtml += renderGridAndToday(range, dayWidth, getSidebarW());

    for (var i = 0; i < job.tasks.length; i++) {
      var task = job.tasks[i];
      var color = PHASE_COLORS[task.color] || PHASE_COLORS.other;
      var tStart = parseDate(task.start);
      var tEnd = parseDate(task.end);
      var leftDays = daysBetween(range.rangeStart, tStart);
      var widthDays = daysBetween(tStart, tEnd) + 1;
      var barClass = task.status === 'complete' ? ' completed-bar' : '';

      bodyHtml += '<div class="timeline-row">';
      bodyHtml += '<div class="row-label" data-task="' + i + '">';
      bodyHtml += '<span class="status-dot ' + task.status + '"></span>';
      bodyHtml += '<span class="job-name stacked"><span class="line1">' + task.name + '</span><span class="line2">' + (task.owner || '') + '</span></span>';
      bodyHtml += '</div>';
      bodyHtml += '<div class="row-track">';
      bodyHtml += '<div class="bar' + barClass + '" data-task="' + i + '" data-type="task" data-job="' + jobId + '" style="left:' + (leftDays * dayWidth) + 'px;width:' + Math.max(widthDays * dayWidth - 2, 24) + 'px;background:' + color + '">';
      bodyHtml += weekendOverlaysHtml(tStart, tEnd, dayWidth);
      bodyHtml += '<div class="drag-handle drag-handle-left" data-side="left"></div>';
      bodyHtml += '<span class="bar-label">' + task.name + '</span>';
      bodyHtml += '<div class="drag-handle drag-handle-right" data-side="right"></div>';
      bodyHtml += '</div>';
      bodyHtml += '</div></div>';
    }

    if (job.tasks.length === 0) {
      bodyHtml += '<div class="timeline-row"><div class="row-label"><span class="job-name">No tasks yet</span></div><div class="row-track"></div></div>';
    }

    bodyHtml += '</div>';

    $timeline.innerHTML = headerHtml + bodyHtml;
    $timeline.style.width = (trackWidth + getSidebarW()) + 'px';

    if (!existingRange) {
      $timeline.classList.add('view-enter');
      setTimeout(function() { $timeline.classList.remove('view-enter'); }, 300);
    }

    // Materials panel
    renderMaterials(job);

    // Bind: click task to open task detail
    $timeline.querySelectorAll('.bar[data-task], .row-label[data-task]').forEach(function(el) {
      el.addEventListener('click', function() {
        if (Date.now() - lastDragEnd < 300) return;
        var ti = parseInt(el.dataset.task);
        renderTaskDetail(jobId, ti);
      });
    });

    // Tooltips on task bars
    $timeline.querySelectorAll('.bar[data-task]').forEach(function(el) {
      var ti = parseInt(el.dataset.task);
      var task = job.tasks[ti];
      if (!task) return;
      el.addEventListener('mouseenter', function(e) {
        var dur = daysBetween(parseDate(task.start), parseDate(task.end)) + 1;
        showTooltip(e,
          '<div class="tooltip-title">' + task.name + '</div>' +
          '<div class="tooltip-row"><strong>Owner:</strong> ' + (task.owner || '—') + '</div>' +
          '<div class="tooltip-row"><strong>Start:</strong> ' + formatDate(parseDate(task.start)) + '</div>' +
          '<div class="tooltip-row"><strong>End:</strong> ' + formatDate(parseDate(task.end)) + '</div>' +
          '<div class="tooltip-row"><strong>Duration:</strong> ' + dur + ' day' + (dur > 1 ? 's' : '') + '</div>' +
          '<div class="tooltip-row"><strong>Status:</strong> ' + task.status + '</div>'
        );
      });
      el.addEventListener('mouseleave', hideTooltip);
    });

    if (!existingRange) {
      attachInfiniteScroll(function(r) { renderDaily(jobId, r, false); }, dayWidth);
    }

    if (doScroll !== false && !existingRange) {
      scrollToToday(range, dayWidth, getSidebarW());
    }
    setTimeout(updateFloatingMonth, 50);
  }

  // ── Toggle buttons ──
  function updateToggle() {
    $btnDaily.classList.toggle('active', currentLevel === 0);
    $btnTimeline.classList.toggle('active', currentLevel === 1);
    $btnProjects.classList.toggle('active', currentLevel === 2);
  }

  function showMonthly() {
    renderPortfolio();
  }

  function showDaily() {
    renderDaily(currentJobId);
  }

  function showWeekly() {
    renderProject();
  }

  // ── Scroll to today ──
  function scrollToToday(range, dayWidth, sidebarWidth) {
    if (today >= range.rangeStart && today <= addDays(range.rangeStart, range.totalDays)) {
      var todayX = daysBetween(range.rangeStart, today) * dayWidth + sidebarWidth;
      var containerWidth = $timelineContainer.clientWidth;
      $timelineContainer.scrollLeft = Math.max(0, todayX - containerWidth / 3);
    }
  }

  function closeDetail() {
    saveScrollPos();
    $detailPanel.classList.remove('visible');
    if (currentLevel === 3) {
      currentLevel = 2;
      updateToggle();
    }
  }

  // ── Add Project ──
  function addProject() {
    var name = prompt('Customer Name:');
    if (!name || !name.trim()) return;
    var type = prompt('Job Type:', 'Master Bath Remodel');
    if (!type || !type.trim()) return;

    // Auto dates: start next Monday from today, 4 weeks
    var startDate = getMonday(addDays(today, 7));
    var startStr = dateToString(startDate);
    var endDate = addDays(startDate, 27);

    var newId = Math.max(0, ...jobs.map(function(j) { return j.id; })) + 1;

    // Default tasks with auto-assigned colors (each picks next unused)
    var defaultTasks = [
      { name: 'Demo', days: [0, 2] },
      { name: 'Plumbing Rough-In', days: [3, 5] },
      { name: 'Backer Board & Waterproofing', days: [8, 10] },
      { name: 'Tile Work', days: [11, 20] },
      { name: 'Fixture Install', days: [23, 24] },
      { name: 'Paint & Finish', days: [25, 26] },
      { name: 'Final Punch & Cleanup', days: [27, 27] }
    ];

    pushUndo();
    var phaseKeys = Object.keys(PHASE_COLORS);
    var tasks = defaultTasks.map(function(t, i) {
      return {
        name: t.name,
        owner: '',
        start: dateToString(addDays(startDate, t.days[0])),
        end: dateToString(addDays(startDate, t.days[1])),
        status: 'scheduled',
        color: phaseKeys[i] || 'other',
        notes: ''
      };
    });

    jobs.push({
      id: newId,
      customer: name.trim(),
      type: type.trim(),
      status: 'scheduled',
      startDate: startStr,
      endDate: dateToString(endDate),
      tasks: tasks
    });
    saveState();
    renderPortfolio();
  }

  function dateToString(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  // ── Drag-to-resize bars ──
  var dragState = null;

  // ── Drag: resize (handles) + move (bar body) ──
  var dragStartTime = 0;
  var lastDragEnd = 0;

  document.addEventListener('mousedown', function(e) {
    // Check for handle first (resize), then bar body (move)
    var handle = e.target.closest('.drag-handle');
    var bar = handle ? handle.closest('.bar') : e.target.closest('.bar');
    if (!bar) return;

    var mode = handle ? handle.dataset.side : 'move'; // 'left', 'right', or 'move'
    var type = bar.dataset.type;

    e.preventDefault();
    e.stopPropagation();

    bar.classList.add('dragging');
    dragStartTime = Date.now();

    var dayW = currentLevel === 1 ? 14 : 48;

    dragState = {
      bar: bar,
      mode: mode,
      type: type,
      startX: e.clientX,
      origLeft: parseFloat(bar.style.left),
      origWidth: parseFloat(bar.style.width),
      dayWidth: dayW,
      currentDayDelta: 0
    };

    if (type === 'job') {
      dragState.jobId = parseInt(bar.dataset.job);
    } else {
      dragState.jobId = parseInt(bar.dataset.job);
      dragState.taskIndex = parseInt(bar.dataset.task);
    }
  });

  document.addEventListener('mousemove', function(e) {
    if (!dragState) return;
    e.preventDefault();

    var dx = e.clientX - dragState.startX;
    var dayDelta = Math.round(dx / dragState.dayWidth);
    var minWidth = dragState.dayWidth - 2;

    if (dragState.mode === 'move') {
      // Move entire bar
      dragState.bar.style.left = (dragState.origLeft + dayDelta * dragState.dayWidth) + 'px';
      dragState.currentDayDelta = dayDelta;
    } else if (dragState.mode === 'left') {
      var newLeft = dragState.origLeft + dayDelta * dragState.dayWidth;
      var newWidth = dragState.origWidth - dayDelta * dragState.dayWidth;
      if (newWidth >= minWidth) {
        dragState.bar.style.left = newLeft + 'px';
        dragState.bar.style.width = newWidth + 'px';
        dragState.currentDayDelta = dayDelta;
      }
    } else {
      var newWidth = dragState.origWidth + dayDelta * dragState.dayWidth;
      if (newWidth >= minWidth) {
        dragState.bar.style.width = newWidth + 'px';
        dragState.currentDayDelta = dayDelta;
      }
    }
  });

  document.addEventListener('mouseup', function(e) {
    if (!dragState) return;

    dragState.bar.classList.remove('dragging');

    var dayDelta = dragState.currentDayDelta || 0;
    // If no movement, treat as a click-through (don't block navigation)
    if (dayDelta === 0) {
      dragState = null;
      return;
    }

    lastDragEnd = Date.now();

    // Snapshot original state for revert
    var ds = dragState;
    var direction = dayDelta > 0 ? dayDelta + ' day' + (dayDelta > 1 ? 's' : '') + ' later' : Math.abs(dayDelta) + ' day' + (Math.abs(dayDelta) > 1 ? 's' : '') + ' earlier';

    function applyDrag() {
      pushUndo();
      if (ds.type === 'job') {
        var job = jobs.find(function(j) { return j.id === ds.jobId; });
        if (job) {
          if (ds.mode === 'move') {
            job.startDate = dateToString(addDays(parseDate(job.startDate), dayDelta));
            job.endDate = dateToString(addDays(parseDate(job.endDate), dayDelta));
            job.tasks.forEach(function(t) {
              t.start = dateToString(addDays(parseDate(t.start), dayDelta));
              t.end = dateToString(addDays(parseDate(t.end), dayDelta));
            });
          } else if (ds.mode === 'left') {
            job.startDate = dateToString(addDays(parseDate(job.startDate), dayDelta));
          } else {
            job.endDate = dateToString(addDays(parseDate(job.endDate), dayDelta));
          }
          saveState();
          if (currentLevel === 0) renderDaily();
          else renderPortfolio();
        }
      } else if (ds.type === 'task') {
        var job = jobs.find(function(j) { return j.id === ds.jobId; });
        if (job && job.tasks[ds.taskIndex]) {
          var task = job.tasks[ds.taskIndex];
          if (ds.mode === 'move') {
            task.start = dateToString(addDays(parseDate(task.start), dayDelta));
            task.end = dateToString(addDays(parseDate(task.end), dayDelta));
          } else if (ds.mode === 'left') {
            task.start = dateToString(addDays(parseDate(task.start), dayDelta));
          } else {
            task.end = dateToString(addDays(parseDate(task.end), dayDelta));
          }
          autoStaggerTasks(job);
          renderProject(ds.jobId);
        }
      }
    }

    function revertVisual() {
      // Reset bar to original position
      ds.bar.style.left = ds.origLeft + 'px';
      ds.bar.style.width = ds.origWidth + 'px';
    }

    // Show confirm dialog
    showConfirmDialog('Move ' + direction + '?', function(confirmed) {
      if (confirmed) {
        applyDrag();
      } else {
        revertVisual();
      }
    });

    dragState = null;
  });

  // ── Touch drag (handles only, no full-bar move on mobile) ──
  document.addEventListener('touchstart', function(e) {
    var handle = e.target.closest('.drag-handle');
    if (!handle) return;

    var bar = handle.closest('.bar');
    if (!bar) return;

    e.preventDefault();
    var touch = e.touches[0];
    var mode = handle.dataset.side;
    var type = bar.dataset.type;

    bar.classList.add('dragging');
    dragStartTime = Date.now();

    var dayW = currentLevel === 1 ? 14 : 48;

    dragState = {
      bar: bar,
      mode: mode,
      type: type,
      startX: touch.clientX,
      origLeft: parseFloat(bar.style.left),
      origWidth: parseFloat(bar.style.width),
      dayWidth: dayW,
      currentDayDelta: 0,
      isTouch: true
    };

    if (type === 'job') {
      dragState.jobId = parseInt(bar.dataset.job);
    } else {
      dragState.jobId = parseInt(bar.dataset.job);
      dragState.taskIndex = parseInt(bar.dataset.task);
    }
  }, { passive: false });

  document.addEventListener('touchmove', function(e) {
    if (!dragState || !dragState.isTouch) return;
    e.preventDefault();

    var touch = e.touches[0];
    var dx = touch.clientX - dragState.startX;
    var dayDelta = Math.round(dx / dragState.dayWidth);
    var minWidth = dragState.dayWidth - 2;

    if (dragState.mode === 'left') {
      var newLeft = dragState.origLeft + dayDelta * dragState.dayWidth;
      var newWidth = dragState.origWidth - dayDelta * dragState.dayWidth;
      if (newWidth >= minWidth) {
        dragState.bar.style.left = newLeft + 'px';
        dragState.bar.style.width = newWidth + 'px';
        dragState.currentDayDelta = dayDelta;
      }
    } else {
      var newWidth = dragState.origWidth + dayDelta * dragState.dayWidth;
      if (newWidth >= minWidth) {
        dragState.bar.style.width = newWidth + 'px';
        dragState.currentDayDelta = dayDelta;
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', function(e) {
    if (!dragState || !dragState.isTouch) return;

    dragState.bar.classList.remove('dragging');
    var dayDelta = dragState.currentDayDelta || 0;

    if (dayDelta === 0) { dragState = null; return; }
    lastDragEnd = Date.now();

    var dsT = dragState;
    var dirT = dayDelta > 0 ? dayDelta + ' day' + (dayDelta > 1 ? 's' : '') + ' later' : Math.abs(dayDelta) + ' day' + (Math.abs(dayDelta) > 1 ? 's' : '') + ' earlier';

    function applyTouchDrag() {
      pushUndo();
      if (dsT.type === 'job') {
        var job = jobs.find(function(j) { return j.id === dsT.jobId; });
        if (job) {
          if (dsT.mode === 'left') {
            job.startDate = dateToString(addDays(parseDate(job.startDate), dayDelta));
          } else {
            job.endDate = dateToString(addDays(parseDate(job.endDate), dayDelta));
          }
          saveState();
          if (currentLevel === 0) renderDaily();
          else renderPortfolio();
        }
      } else if (dsT.type === 'task') {
        var job = jobs.find(function(j) { return j.id === dsT.jobId; });
        if (job && job.tasks[dsT.taskIndex]) {
          var task = job.tasks[dsT.taskIndex];
          if (dsT.mode === 'left') {
            task.start = dateToString(addDays(parseDate(task.start), dayDelta));
          } else {
            task.end = dateToString(addDays(parseDate(task.end), dayDelta));
          }
          autoStaggerTasks(job);
          renderProject(dsT.jobId);
        }
      }
    }

    function revertTouchVisual() {
      dsT.bar.style.left = dsT.origLeft + 'px';
      dsT.bar.style.width = dsT.origWidth + 'px';
    }

    showConfirmDialog('Move ' + dirT + '?', function(confirmed) {
      if (confirmed) applyTouchDrag();
      else revertTouchVisual();
    });

    dragState = null;
  });

  // ── Confirm Dialog ──
  function showConfirmDialog(message, callback) {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML =
      '<div class="confirm-box">' +
        '<div class="confirm-msg">' + message + '</div>' +
        '<div class="confirm-btns">' +
          '<button class="confirm-btn confirm-cancel">Cancel</button>' +
          '<button class="confirm-btn confirm-save">Save</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.confirm-save').addEventListener('click', function() {
      document.body.removeChild(overlay);
      callback(true);
    });
    overlay.querySelector('.confirm-cancel').addEventListener('click', function() {
      document.body.removeChild(overlay);
      callback(false);
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        callback(false);
      }
    });
  }

  // ── Drag-to-create on empty timeline area (Level 1: projects, Level 2: tasks) ──
  var createDrag = null;

  document.addEventListener('mousedown', function(e) {
    if (currentLevel === 3) return; // no drag-create on task detail
    if (currentLevel === 0 && !currentJobId) return; // Daily needs a project
    if (dragState) return; // existing bar drag in progress
    // Only trigger on row-track or timeline-body (empty area), not on bars or sidebar
    var track = e.target.closest('.row-track') || ((currentLevel === 1 || currentLevel === 2) ? e.target.closest('.timeline-body') : null);
    if (!track) return;
    if (e.target.closest('.bar')) return;
    if (e.target.closest('.row-label')) return;
    if (e.target.closest('.add-project-row')) return;
    if (e.target.closest('.add-task-row')) return;

    e.preventDefault();
    // Calculate dayWidth based on current level
    var dayWidth;
    if (currentLevel === 0) {
      var sw = getSidebarW();
      var cw = $timelineContainer.clientWidth || window.innerWidth;
      dayWidth = Math.floor((cw - sw) / 7);
      if (dayWidth < 48) dayWidth = 48;
    } else if (currentLevel === 1) {
      var sw1 = getSidebarW();
      var cw1 = $timelineContainer.clientWidth || window.innerWidth;
      dayWidth = Math.floor((cw1 - sw1) / 90);
      if (dayWidth < 4) dayWidth = 4;
    } else {
      var sw2 = getSidebarW();
      var cw2 = $timelineContainer.clientWidth || window.innerWidth;
      dayWidth = Math.floor((cw2 - sw2) / 30);
      if (dayWidth < 14) dayWidth = 14;
    }
    var sidebarW = getSidebarW();
    var containerRect = $timelineContainer.getBoundingClientRect();
    var scrollLeft = $timelineContainer.scrollLeft;

    // x relative to timeline content
    var xInTimeline = e.clientX - containerRect.left + scrollLeft - sidebarW;
    var startDay = Math.floor(xInTimeline / dayWidth);

    // Create preview bar
    var preview = document.createElement('div');
    preview.className = 'bar create-preview';
    preview.style.position = 'absolute';
    preview.style.top = '8px';
    preview.style.height = '32px';
    preview.style.left = (startDay * dayWidth) + 'px';
    preview.style.width = dayWidth + 'px';
    preview.style.background = 'rgba(97,175,239,0.4)';
    preview.style.border = '2px dashed #61afef';
    preview.style.borderRadius = '6px';
    preview.style.zIndex = '20';
    preview.style.pointerEvents = 'none';
    track.appendChild(preview);

    createDrag = {
      track: track,
      preview: preview,
      startDay: startDay,
      currentDay: startDay,
      dayWidth: dayWidth,
      sidebarW: sidebarW,
      containerRect: containerRect
    };
  });

  document.addEventListener('mousemove', function(e) {
    if (!createDrag) return;
    e.preventDefault();
    var scrollLeft = $timelineContainer.scrollLeft;
    var xInTimeline = e.clientX - createDrag.containerRect.left + scrollLeft - createDrag.sidebarW;
    var endDay = Math.floor(xInTimeline / createDrag.dayWidth);

    var minD = Math.min(createDrag.startDay, endDay);
    var maxD = Math.max(createDrag.startDay, endDay);
    createDrag.preview.style.left = (minD * createDrag.dayWidth) + 'px';
    createDrag.preview.style.width = ((maxD - minD + 1) * createDrag.dayWidth) + 'px';
    createDrag.currentDay = endDay;
  });

  document.addEventListener('mouseup', function(e) {
    if (!createDrag) return;
    var cd = createDrag;
    createDrag = null;

    // Remove preview
    if (cd.preview.parentNode) cd.preview.parentNode.removeChild(cd.preview);

    if (!infiniteState) return;
    var minD = Math.min(cd.startDay, cd.currentDay);
    var maxD = Math.max(cd.startDay, cd.currentDay);

    // Need at least 1 day dragged
    if (minD === maxD && Math.abs(cd.currentDay - cd.startDay) === 0) {
      // Single click, not a drag — ignore
      return;
    }

    // Convert day offsets to actual dates
    var dragStart = addDays(infiniteState.rangeStart, minD);
    var dragEnd = addDays(infiniteState.rangeStart, maxD);

    if (currentLevel === 0) {
      // Daily: create a new task for the current project
      var job = jobs.find(function(j) { return j.id === currentJobId; });
      if (!job) return;

      var taskName = prompt('Task name:', 'New Task');
      if (!taskName || !taskName.trim()) return;

      pushUndo();
      var usedColors = job.tasks.map(function(t) { return t.color; });
      var color = nextColor(usedColors);

      job.tasks.push({
        name: taskName.trim(),
        owner: '',
        start: dateToString(dragStart),
        end: dateToString(dragEnd),
        status: 'scheduled',
        color: color,
        notes: '',
        notesList: []
      });

      saveState();
      saveScrollPos();
      autoStaggerTasks(job);
      renderDaily(currentJobId);
    } else if (currentLevel === 1 || currentLevel === 2) {
      // Timeline or Projects: create a new project
      var customerName = prompt('Customer name:', 'New Project');
      if (!customerName || !customerName.trim()) return;

      pushUndo();
      var newId = jobs.length > 0 ? Math.max.apply(null, jobs.map(function(j) { return j.id; })) + 1 : 1;
      jobs.push({
        id: newId,
        customer: customerName.trim(),
        type: 'Full Remodel',
        status: 'scheduled',
        startDate: dateToString(dragStart),
        endDate: dateToString(dragEnd),
        tasks: [],
        photos: []
      });

      saveState();
      saveScrollPos();
      if (currentLevel === 1) showMonthly();
      else renderProject();
    }
  });

  // ── Public API ──
  window.app = {
    showDaily,
    showMonthly,
    showWeekly,
    closeDetail,
    deleteProject,
    deleteTask,
    undo
  };

  // ── Init ──
  renderPortfolio();
  updateUndoBtn();

})();
