// app.js — Bath Foundry Schedule
// Pure vanilla JS, no dependencies

(function() {
  'use strict';

  // ── State ──
  let jobs = JSON.parse(JSON.stringify(SAMPLE_JOBS)); // deep clone
  let currentLevel = 1;  // 1=timeline, 2=project, 3=task
  let currentJobId = null;
  let currentTaskIndex = null;

  // Load saved edits from localStorage
  const saved = localStorage.getItem('bf_jobs');
  if (saved) {
    try { jobs = JSON.parse(saved); } catch(e) { /* use defaults */ }
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
  let templates = [];
  const savedTemplates = localStorage.getItem('bf_templates');
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

    var startDate = getMonday(addDays(today, 7));
    var newId = Math.max(0, ...jobs.map(function(j) { return j.id; })) + 1;

    var tasks = template.tasks.map(function(t) {
      return {
        name: t.name,
        owner: t.owner || '',
        start: dateToStringHelper(addDays(startDate, t.startDay)),
        end: dateToStringHelper(addDays(startDate, t.endDay)),
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
      startDate: dateToStringHelper(startDate),
      endDate: dateToStringHelper(addDays(startDate, lastDay)),
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
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return fullName;
    // "Tom & Amy Wilson" → "Tom & Amy W."
    // "John Smith" → "John S."
    const last = parts[parts.length - 1];
    const rest = parts.slice(0, -1).join(' ');
    return rest + ' ' + last.charAt(0) + '.';
  }

  // ── Date Helpers ──
  const DAY_MS = 86400000;

  function parseDate(s) { 
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m-1, d);
  }

  function formatDate(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / DAY_MS);
  }

  function getMonday(d) {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    dt.setDate(dt.getDate() + diff);
    return dt;
  }

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ── Today ──
  const today = new Date();
  today.setHours(0,0,0,0);

  // ── DOM refs ──
  const $timeline = document.getElementById('timeline');
  const $statsBar = document.getElementById('statsBar');
  const $btnTimeline = document.getElementById('btnTimeline');
  const $btnProjects = document.getElementById('btnProjects');
  const $tooltip = document.getElementById('tooltip');
  const $detailPanel = document.getElementById('detailPanel');
  const $detailContent = document.getElementById('detailContent');
  const $timelineContainer = document.getElementById('timelineContainer');
  const $bottomBar = document.getElementById('bottomBar');
  const $materialsList = document.getElementById('materialsList');
  const $photosGrid = document.getElementById('photosGrid');

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
    const pad = 12;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const rect = $tooltip.getBoundingClientRect();
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

  // ── Compute timeline range and pixel mapping ──
  function computeRange(startDate, endDate, paddingDays) {
    const rangeStart = getMonday(addDays(startDate, -paddingDays));
    const rangeEnd = addDays(endDate, paddingDays);
    const totalDays = daysBetween(rangeStart, rangeEnd);
    return { rangeStart, rangeEnd, totalDays };
  }

  // ── Build 3-layer project header: Month → Mon/Fri labels → Day ticks ──
  function buildHeader(range, dayWidth) {
    const { rangeStart, totalDays } = range;
    const trackWidth = totalDays * dayWidth;

    // Layer 1: Months
    const months = [];
    let d = new Date(rangeStart);
    while (d < addDays(rangeStart, totalDays)) {
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const visEnd = monthEnd > addDays(rangeStart, totalDays) ? addDays(rangeStart, totalDays) : monthEnd;
      const days = daysBetween(d, visEnd) + 1;
      months.push({ label: MONTH_FULL[d.getMonth()] + ' ' + d.getFullYear(), days: days });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }

    // Layer 2: Mon/Fri positioned absolutely over their exact day
    // Layer 3: Day tick marks for every day
    const monFriMarkers = [];
    const dayTicks = [];
    for (let i = 0; i < totalDays; i++) {
      const dd = addDays(rangeStart, i);
      const dow = dd.getDay();
      const isWeekend = (dow === 0 || dow === 6);
      const isToday = dd.getTime() === today.getTime();

      dayTicks.push({ isWeekend: isWeekend, isToday: isToday, isMonday: dow === 1 });

      if (dow === 1) {
        monFriMarkers.push({ label: 'Mon ' + dd.getDate(), dayIndex: i });
      } else if (dow === 5) {
        monFriMarkers.push({ label: 'Fri ' + dd.getDate(), dayIndex: i });
      }
    }

    let html = '<div class="timeline-header">';
    html += '<div class="timeline-sidebar-header">Projects</div>';
    html += '<div class="timeline-dates" style="width:' + trackWidth + 'px">';

    // Layer 1: Month row (with absolute-positioned dividers for alignment)
    html += '<div class="month-row" style="position:relative">';
    for (const m of months) {
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
    for (const mf of monFriMarkers) {
      const left = mf.dayIndex * dayWidth;
      html += '<div class="mf-label" style="left:' + left + 'px">' + mf.label + '</div>';
    }
    html += '</div>';

    // Layer 3: Day tick marks removed — grid lines in body suffice

    html += '</div></div>';
    return { html, trackWidth };
  }

  // ── Build daily header (for task-level view) ──
  function buildHeaderDaily(range, dayWidth) {
    const { rangeStart, totalDays } = range;
    const trackWidth = totalDays * dayWidth;

    // Collect months
    const months = [];
    let d = new Date(rangeStart);
    while (d < addDays(rangeStart, totalDays)) {
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const visEnd = monthEnd > addDays(rangeStart, totalDays) ? addDays(rangeStart, totalDays) : monthEnd;
      const days = daysBetween(d, visEnd) + 1;
      months.push({ label: MONTH_FULL[d.getMonth()] + ' ' + d.getFullYear(), days: days });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }

    // Individual days
    const dayLabels = [];
    const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (let i = 0; i < totalDays; i++) {
      const dd = addDays(rangeStart, i);
      const isWeekend = dd.getDay() === 0 || dd.getDay() === 6;
      dayLabels.push({
        label: DOW[dd.getDay()] + ' ' + dd.getDate(),
        isWeekend: isWeekend,
        isToday: dd.getTime() === today.getTime()
      });
    }

    let html = '<div class="timeline-header">';
    html += '<div class="timeline-sidebar-header">Tasks</div>';
    html += '<div class="timeline-dates" style="width:' + trackWidth + 'px">';

    // Month row (with aligned dividers)
    html += '<div class="month-row" style="position:relative">';
    for (const m of months) {
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
    for (const dl of dayLabels) {
      let cls = 'day-label';
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
    const done = job.tasks.filter(t => t.status === 'complete').length;
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
  const $floatingMonth = document.getElementById('floatingMonth');
  let monthBoundaries = []; // [{x: px from content left, label: 'February 2026'}, ...]

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
  let savedScrollLeft = null;

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
  let infiniteState = null;
  let scrollHandler = null;

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
    const active = jobs.filter(j => j.status === 'active').length;
    const scheduled = jobs.filter(j => j.status === 'scheduled').length;
    const completed = jobs.filter(j => j.status === 'completed').length;
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

    const dayWidth = 14;
    const { html: headerHtml, trackWidth } = buildHeader(range, dayWidth);

    // Body rows
    const sorted = [...jobs].sort((a,b) => parseDate(a.startDate) - parseDate(b.startDate));
    let bodyHtml = '<div class="timeline-body" style="position:relative">';

    // Grid lines (every day, stronger on Mondays, shaded weekends, month boundaries)
    for (let gi = 0; gi < range.totalDays; gi++) {
      const gDay = addDays(range.rangeStart, gi);
      const x = gi * dayWidth + getSidebarW();
      const isMon = gDay.getDay() === 1;
      const isWeekend = gDay.getDay() === 0 || gDay.getDay() === 6;
      const isMonthStart = gDay.getDate() === 1;
      if (isWeekend) {
        bodyHtml += '<div class="grid-line weekend-bg" style="left:' + x + 'px;width:' + dayWidth + 'px"></div>';
      }
      var gridCls = 'grid-line';
      if (isMonthStart) gridCls += ' grid-month';
      else if (isMon) gridCls += ' grid-monday';
      bodyHtml += '<div class="' + gridCls + '" style="left:' + x + 'px"></div>';
    }

    // Build month boundaries for floating label
    buildMonthBoundaries(range, dayWidth);

    // Today line (always render — range is huge)
    const tx = daysBetween(range.rangeStart, today) * dayWidth + getSidebarW();
    bodyHtml += '<div class="today-line" style="left:' + tx + 'px"></div>';

    for (let i = 0; i < sorted.length; i++) {
      const job = sorted[i];
      const jobColor = JOB_COLORS[job.id % JOB_COLORS.length];
      const start = parseDate(job.startDate);
      const end = parseDate(job.endDate);
      const leftDays = daysBetween(range.rangeStart, start);
      const widthDays = daysBetween(start, end) + 1;
      const pct = jobProgress(job);
      const barClass = job.status === 'completed' ? ' completed-bar' : '';

      bodyHtml += '<div class="timeline-row">';
      bodyHtml += '<div class="row-label" data-job="' + job.id + '">';
      bodyHtml += '<span class="status-dot ' + job.status + '"></span>';
      bodyHtml += '<span class="job-name stacked"><span class="line1">' + shortName(job.customer) + '</span><span class="line2">' + job.type + '</span></span>';
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

    // Add Project row
    bodyHtml += '<div class="timeline-row add-project-row">';
    bodyHtml += '<div class="row-label add-project-btn" id="addProjectBtn">';
    bodyHtml += '<span class="add-icon">+</span>';
    bodyHtml += '<span class="job-name">Add Project</span>';
    bodyHtml += '</div>';
    bodyHtml += '<div class="row-track" style="display:flex;align-items:center;padding-left:12px;">';
    bodyHtml += '<span class="add-from-template-btn" id="fromTemplateBtn">or from template</span>';
    bodyHtml += '</div></div>';

    bodyHtml += '</div>';

    $timeline.innerHTML = headerHtml + bodyHtml;
    $timeline.style.width = (trackWidth + getSidebarW()) + 'px';

    if (!existingRange) {
      $timeline.classList.add('view-enter');
      setTimeout(() => $timeline.classList.remove('view-enter'), 300);
    }

    // Add Project click
    document.getElementById('addProjectBtn').addEventListener('click', addProject);
    document.getElementById('fromTemplateBtn').addEventListener('click', showTemplateDialog);

    // Bind events (skip if drag just ended)
    $timeline.querySelectorAll('.bar[data-job], .row-label[data-job]').forEach(el => {
      el.addEventListener('click', () => {
        if (Date.now() - lastDragEnd < 300) return;
        const jid = parseInt(el.dataset.job);
        renderProject(jid);
      });
    });

    // Tooltips on bars
    $timeline.querySelectorAll('.bar[data-job]').forEach(el => {
      const job = jobs.find(j => j.id === parseInt(el.dataset.job));
      el.addEventListener('mouseenter', (e) => {
        const pct = jobProgress(job);
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

  // ── Render Level 2: Project (shows tasks) ──
  function renderProject(jobId, existingRange, doScroll) {
    currentLevel = 2;
    currentJobId = jobId;
    currentTaskIndex = null;
    $detailPanel.classList.remove('visible');

    const job = jobs.find(j => j.id === jobId);
    if (!job) return renderPortfolio();

    // Stats
    const done = job.tasks.filter(t => t.status === 'complete').length;
    const inProg = job.tasks.filter(t => t.status === 'active').length;
    const sched = job.tasks.filter(t => t.status === 'scheduled').length;
    const totalDuration = daysBetween(parseDate(job.startDate), parseDate(job.endDate)) + 1;
    const projectDisplayName = job.customer + ' — ' + job.type;

    if (!existingRange) {
      $statsBar.innerHTML =
        '<div class="project-title"><span class="status-dot ' + job.status + '"></span><span class="project-name-text" id="projectNameText">' + projectDisplayName + '</span><button class="edit-name-btn" id="editNameBtn" title="Edit project name">✏️</button><button class="edit-name-btn" id="saveTemplateBtn" title="Save as Template">📋</button><button class="delete-project-btn" id="deleteProjectBtn" title="Delete project">🗑️</button></div>' +
        '<div class="stat"><strong>' + done + '</strong> Complete</div>' +
        '<div class="stat"><strong>' + inProg + '</strong> In Progress</div>' +
        '<div class="stat"><strong>' + sched + '</strong> Scheduled</div>' +
        '<div class="stat"><strong>' + totalDuration + '</strong> Days Total</div>';

      // Delete project + Editable project name
      setTimeout(function() {
        const delProjBtn = document.getElementById('deleteProjectBtn');
        if (delProjBtn) {
          delProjBtn.addEventListener('click', function() { deleteProject(jobId); });
        }
        const tmplBtn = document.getElementById('saveTemplateBtn');
        if (tmplBtn) {
          tmplBtn.addEventListener('click', function() { saveAsTemplate(jobId); });
        }
        const editBtn = document.getElementById('editNameBtn');
        if (editBtn) {
          editBtn.addEventListener('click', function() {
            const nameEl = document.getElementById('projectNameText');
            const currentName = job.customer;
            const currentType = job.type;
            nameEl.innerHTML = '<input type="text" id="editCustomerInput" class="inline-edit" value="' + currentName.replace(/"/g, '&quot;') + '" placeholder="Customer name" /> — <input type="text" id="editTypeInput" class="inline-edit" value="' + currentType.replace(/"/g, '&quot;') + '" placeholder="Project type" /><button class="inline-save-btn" id="saveNameBtn">Save</button><button class="inline-cancel-btn" id="cancelNameBtn">Cancel</button>';
            editBtn.style.display = 'none';
            document.getElementById('editCustomerInput').focus();

            document.getElementById('saveNameBtn').addEventListener('click', function() {
              const newCustomer = document.getElementById('editCustomerInput').value.trim();
              const newType = document.getElementById('editTypeInput').value.trim();
              if (newCustomer) job.customer = newCustomer;
              if (newType) job.type = newType;
              saveState();
              renderProject(jobId);
            });

            document.getElementById('cancelNameBtn').addEventListener('click', function() {
              renderProject(jobId);
            });

            ['editCustomerInput', 'editTypeInput'].forEach(function(id) {
              document.getElementById(id).addEventListener('keydown', function(e) {
                if (e.key === 'Enter') document.getElementById('saveNameBtn').click();
                if (e.key === 'Escape') document.getElementById('cancelNameBtn').click();
              });
            });
          });
        }
      }, 0);
    }

    updateToggle();

    // Range — start wide for infinite scroll
    var range;
    if (existingRange) {
      range = existingRange;
    } else {
      detachInfiniteScroll();
      var start = parseDate(job.startDate);
      var end = parseDate(job.endDate);
      var projectDays = daysBetween(start, end);
      // Pad generously: 30 days before, 60 days after (or more for long projects)
      var padBefore = Math.max(30, projectDays);
      var padAfter = Math.max(60, projectDays);
      var rangeStart = getMonday(addDays(start, -padBefore));
      var rangeEnd = addDays(end, padAfter);
      var totalDays = daysBetween(rangeStart, rangeEnd);
      range = { rangeStart: rangeStart, rangeEnd: rangeEnd, totalDays: totalDays };
    }
    infiniteState = range;

    const dayWidth = 48;

    const { html: headerHtml, trackWidth } = buildHeaderDaily(range, dayWidth);

    let bodyHtml = '<div class="timeline-body" style="position:relative">';

    // Daily grid lines (with month boundaries)
    for (let gi = 0; gi <= range.totalDays; gi++) {
      const gDay = addDays(range.rangeStart, gi);
      const isWeekend = gDay.getDay() === 0 || gDay.getDay() === 6;
      const isMonthStart = gDay.getDate() === 1;
      const x = gi * dayWidth + getSidebarW();
      if (isWeekend) {
        bodyHtml += '<div class="grid-line weekend-bg" style="left:' + x + 'px;width:' + dayWidth + 'px"></div>';
      }
      var gcls = 'grid-line';
      if (isMonthStart) gcls += ' grid-month';
      bodyHtml += '<div class="' + gcls + '" style="left:' + x + 'px"></div>';
    }

    // Build month boundaries for floating label
    buildMonthBoundaries(range, dayWidth);

    // Today line (always)
    const tx = daysBetween(range.rangeStart, today) * dayWidth + getSidebarW();
    bodyHtml += '<div class="today-line" style="left:' + tx + 'px"></div>';

    for (let i = 0; i < job.tasks.length; i++) {
      const task = job.tasks[i];
      const tStart = parseDate(task.start);
      const tEnd = parseDate(task.end);
      const leftDays = daysBetween(range.rangeStart, tStart);
      const widthDays = daysBetween(tStart, tEnd) + 1;
      const color = PHASE_COLORS[task.color] || PHASE_COLORS.other;
      const barClass = task.status === 'complete' ? ' completed-bar' : '';

      bodyHtml += '<div class="timeline-row">';
      bodyHtml += '<div class="row-label" data-task="' + i + '">';
      bodyHtml += '<span class="status-dot ' + task.status + '"></span>';
      bodyHtml += '<span class="job-name stacked"><span class="line1">' + task.name + '</span><span class="line2">' + task.owner + '</span></span>';
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

    // Add Task row
    bodyHtml += '<div class="timeline-row add-task-row">';
    bodyHtml += '<div class="row-label add-task-btn" id="addTaskBtn">';
    bodyHtml += '<span class="add-icon">+</span>';
    bodyHtml += '<span class="job-name">Add Task</span>';
    bodyHtml += '</div>';
    bodyHtml += '<div class="row-track"></div></div>';

    bodyHtml += '</div>';

    $timeline.innerHTML = headerHtml + bodyHtml;
    $timeline.style.width = (trackWidth + getSidebarW()) + 'px';

    if (!existingRange) {
      $timeline.classList.add('view-enter');
      setTimeout(() => $timeline.classList.remove('view-enter'), 300);
    }

    // Bind (skip if drag just ended)
    $timeline.querySelectorAll('.bar[data-task], .row-label[data-task]').forEach(el => {
      el.addEventListener('click', () => {
        if (Date.now() - lastDragEnd < 300) return;
        const ti = parseInt(el.dataset.task);
        renderTaskDetail(jobId, ti);
      });
    });

    // Tooltips
    $timeline.querySelectorAll('.bar[data-task]').forEach(el => {
      const task = job.tasks[parseInt(el.dataset.task)];
      el.addEventListener('mouseenter', (e) => {
        const dur = daysBetween(parseDate(task.start), parseDate(task.end)) + 1;
        showTooltip(e,
          '<div class="tooltip-title">' + task.name + '</div>' +
          '<div class="tooltip-row"><strong>Owner:</strong> ' + task.owner + '</div>' +
          '<div class="tooltip-row"><strong>Start:</strong> ' + formatDate(parseDate(task.start)) + '</div>' +
          '<div class="tooltip-row"><strong>End:</strong> ' + formatDate(parseDate(task.end)) + '</div>' +
          '<div class="tooltip-row"><strong>Duration:</strong> ' + dur + ' day' + (dur > 1 ? 's' : '') + '</div>' +
          '<div class="tooltip-row"><strong>Status:</strong> ' + task.status + '</div>'
        );
      });
      el.addEventListener('mouseleave', hideTooltip);
    });

    // Materials panel (external, sticky)
    renderMaterials(job);

    // Add Task click
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', function() { addTask(jobId); });
    }

    // Attach infinite scroll
    if (!existingRange) {
      attachInfiniteScroll(function(r) { renderProject(jobId, r, false); }, dayWidth);
    }

    // Scroll: restore saved position if returning from task detail, otherwise scroll to today
    if (savedScrollLeft !== null) {
      restoreScrollPos();
    } else if (doScroll !== false && !existingRange) {
      scrollToToday(range, dayWidth, getSidebarW());
    }
    setTimeout(updateFloatingMonth, 50);
  }

  // ── Pick next unused phase color ──
  function nextColor(usedColors) {
    const allColors = Object.keys(PHASE_COLORS);
    for (const c of allColors) {
      if (!usedColors.includes(c)) return c;
    }
    return 'other'; // all used, fallback
  }

  // ── Add Task to a Project ──
  function addTask(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const name = prompt('Task Name:');
    if (!name || !name.trim()) return;

    const owner = prompt('Owner:', '') || '';

    // Auto-select color (first unused)
    const usedColors = job.tasks.map(t => t.color);
    const color = nextColor(usedColors);

    // Auto-select dates: after last task, 2-day duration
    let startDate;
    if (job.tasks.length > 0) {
      const lastTask = job.tasks[job.tasks.length - 1];
      startDate = addDays(parseDate(lastTask.end), 1);
    } else {
      startDate = parseDate(job.startDate);
    }
    const endDate = addDays(startDate, 1);

    job.tasks.push({
      name: name.trim(),
      owner: owner.trim(),
      start: dateToStringHelper(startDate),
      end: dateToStringHelper(endDate),
      status: 'scheduled',
      color: color,
      notes: ''
    });

    autoStaggerTasks(job);
    renderProject(jobId);
  }

  // ── Render Materials + Photos (sticky bottom bar) ──
  function renderMaterials(job) {
    if (!job.materials) job.materials = [];
    if (!job.photos) job.photos = [];
    $bottomBar.style.display = 'flex';

    let html = '';
    for (let mi = 0; mi < job.materials.length; mi++) {
      const mat = job.materials[mi];
      html += '<div class="material-item" data-index="' + mi + '">';
      html += '<input type="checkbox" class="material-check" ' + (mat.done ? 'checked' : '') + ' data-mi="' + mi + '">';
      html += '<span class="material-text' + (mat.done ? ' done' : '') + '">' + mat.text + '</span>';
      html += '<button class="material-delete" data-mi="' + mi + '">×</button>';
      html += '</div>';
    }
    $materialsList.innerHTML = html;

    // Rebind events
    const matInput = document.getElementById('newMaterialInput');
    const matAddBtn = document.getElementById('addMaterialBtn');

    // Clone to remove old listeners
    const newAddBtn = matAddBtn.cloneNode(true);
    matAddBtn.parentNode.replaceChild(newAddBtn, matAddBtn);
    const newInput = matInput.cloneNode(true);
    matInput.parentNode.replaceChild(newInput, matInput);

    newAddBtn.addEventListener('click', function() {
      const text = newInput.value.trim();
      if (!text) return;
      job.materials.push({ text: text, done: false });
      newInput.value = '';
      saveState();
      renderMaterials(job);
    });
    newInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') newAddBtn.click();
    });

    $materialsList.querySelectorAll('.material-check').forEach(function(cb) {
      cb.addEventListener('change', function() {
        const mi = parseInt(this.dataset.mi);
        job.materials[mi].done = this.checked;
        saveState();
        renderMaterials(job);
      });
    });
    $materialsList.querySelectorAll('.material-delete').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const mi = parseInt(this.dataset.mi);
        job.materials.splice(mi, 1);
        saveState();
        renderMaterials(job);
      });
    });

    // Notes (list-based)
    if (!job.notesList) job.notesList = [];
    const $notesList = document.getElementById('notesList');
    let notesHtml = '';
    for (let ni = 0; ni < job.notesList.length; ni++) {
      const note = job.notesList[ni];
      const timeStr = note.time ? new Date(note.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      notesHtml += '<div class="note-item" data-ni="' + ni + '">';
      notesHtml += '<div style="flex:1"><div class="note-text">' + note.text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
      if (timeStr) notesHtml += '<div class="note-time">' + timeStr + '</div>';
      notesHtml += '</div>';
      notesHtml += '<button class="note-delete" data-ni="' + ni + '">×</button>';
      notesHtml += '</div>';
    }
    $notesList.innerHTML = notesHtml;

    // Note add
    const noteInput = document.getElementById('newNoteInput');
    const noteAddBtn = document.getElementById('addNoteBtn');
    const newNoteBtn = noteAddBtn.cloneNode(true);
    noteAddBtn.parentNode.replaceChild(newNoteBtn, noteAddBtn);
    const newNoteInput = noteInput.cloneNode(true);
    noteInput.parentNode.replaceChild(newNoteInput, noteInput);

    newNoteBtn.addEventListener('click', function() {
      const text = newNoteInput.value.trim();
      if (!text) return;
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
        const ni = parseInt(this.dataset.ni);
        job.notesList.splice(ni, 1);
        saveState();
        renderMaterials(job);
      });
    });

    // Photos
    let photosHtml = '';
    for (let pi = 0; pi < job.photos.length; pi++) {
      photosHtml += '<div class="photo-wrapper" data-pi="' + pi + '">';
      photosHtml += '<img class="photo-thumb" src="' + job.photos[pi] + '" />';
      photosHtml += '<button class="photo-remove" data-pi="' + pi + '">×</button>';
      photosHtml += '</div>';
    }
    $photosGrid.innerHTML = photosHtml;

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
    $photosGrid.querySelectorAll('.photo-thumb').forEach(function(img) {
      img.addEventListener('click', function() {
        openLightbox(this.src);
      });
    });

    // Photo remove
    $photosGrid.querySelectorAll('.photo-remove').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const pi = parseInt(this.dataset.pi);
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
      const allStarts = job.tasks.map(function(t) { return parseDate(t.start); });
      const allEnds = job.tasks.map(function(t) { return parseDate(t.end); });
      job.startDate = dateToString(new Date(Math.min.apply(null, allStarts)));
      job.endDate = dateToString(new Date(Math.max.apply(null, allEnds)));
    }
    saveState();
  }

  // ── Delete a project ──
  function deleteProject(jobId) {
    showConfirmDialog('Delete this entire project?', function(confirmed) {
      if (!confirmed) return;
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
      const job = jobs.find(function(j) { return j.id === jobId; });
      if (!job) return;
      job.tasks.splice(taskIndex, 1);
      autoStaggerTasks(job);
      $detailPanel.classList.remove('visible');
      renderProject(jobId);
    });
  }

  // ── Render Level 3: Task Detail (fully editable) ──
  function renderTaskDetail(jobId, taskIndex) {
    // Save scroll before any re-render
    if (currentLevel !== 3) saveScrollPos();
    currentLevel = 3;
    currentJobId = jobId;
    currentTaskIndex = taskIndex;

    const job = jobs.find(j => j.id === jobId);
    if (!job) return renderPortfolio();
    const task = job.tasks[taskIndex];
    if (!task) return renderProject(jobId);

    updateToggle();

    // Show detail panel
    $detailPanel.classList.add('visible');

    const color = PHASE_COLORS[task.color] || PHASE_COLORS.other;
    const dur = daysBetween(parseDate(task.start), parseDate(task.end)) + 1;

    // Build color picker options
    let colorOptionsHtml = '';
    const colorKeys = Object.keys(PHASE_COLORS);
    for (let ci = 0; ci < colorKeys.length; ci++) {
      const ck = colorKeys[ci];
      const sel = task.color === ck ? ' selected' : '';
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
      saveScrollPos();
      const newName = document.getElementById('taskNameInput').value.trim();
      const newOwner = document.getElementById('taskOwnerInput').value.trim();
      const newStatus = document.getElementById('taskStatus').value;
      const newStart = document.getElementById('taskStartInput').value;
      const newEnd = document.getElementById('taskEndInput').value;

      if (newName) task.name = newName;
      task.owner = newOwner;
      task.status = newStatus;

      if (newStart && newEnd && parseDate(newStart) <= parseDate(newEnd)) {
        task.start = newStart;
        task.end = newEnd;
      }

      // Update job status
      const allComplete = job.tasks.every(function(t) { return t.status === 'complete'; });
      const anyActive = job.tasks.some(function(t) { return t.status === 'active'; });
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
    const $taskNotesList = document.getElementById('taskNotesList');
    function renderTaskNotes() {
      let nh = '';
      for (let ni = 0; ni < task.notesList.length; ni++) {
        const note = task.notesList[ni];
        const timeStr = note.time ? new Date(note.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
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
      const input = document.getElementById('taskNoteInput');
      const text = input.value.trim();
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

  // ── Toggle buttons ──
  function updateToggle() {
    $btnTimeline.classList.toggle('active', currentLevel === 1);
    $btnProjects.classList.toggle('active', currentLevel === 2);
  }

  function showTimeline() {
    renderPortfolio();
  }

  function showProjects() {
    if (currentJobId) {
      renderProject(currentJobId);
    } else if (jobs.length > 0) {
      // Default to first active or first job
      const active = jobs.find(j => j.status === 'active') || jobs[0];
      renderProject(active.id);
    }
  }

  // ── Scroll to today ──
  function scrollToToday(range, dayWidth, sidebarWidth) {
    if (today >= range.rangeStart && today <= addDays(range.rangeStart, range.totalDays)) {
      const todayX = daysBetween(range.rangeStart, today) * dayWidth + sidebarWidth;
      const containerWidth = $timelineContainer.clientWidth;
      $timelineContainer.scrollLeft = Math.max(0, todayX - containerWidth / 3);
    }
  }

  // ── Navigation ──
  function updateTaskStatus(val) {
    saveScrollPos();
    const job = jobs.find(j => j.id === currentJobId);
    if (job && job.tasks[currentTaskIndex]) {
      job.tasks[currentTaskIndex].status = val;
      // Update job status based on tasks
      const allComplete = job.tasks.every(t => t.status === 'complete');
      const anyActive = job.tasks.some(t => t.status === 'active');
      if (allComplete) job.status = 'completed';
      else if (anyActive) job.status = 'active';
      else job.status = 'scheduled';
      saveState();
      // Re-render project view in background (the bars)
      renderProject(currentJobId);
      renderTaskDetail(currentJobId, currentTaskIndex);
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
    const name = prompt('Customer Name:');
    if (!name || !name.trim()) return;
    const type = prompt('Job Type:', 'Master Bath Remodel');
    if (!type || !type.trim()) return;

    // Auto dates: start next Monday from today, 4 weeks
    const startDate = getMonday(addDays(today, 7));
    const startStr = dateToStringHelper(startDate);
    const endDate = addDays(startDate, 27);

    // Auto color: pick next unused job color
    const usedJobColors = jobs.map((j, i) => i % JOB_COLORS.length);

    const newId = Math.max(0, ...jobs.map(j => j.id)) + 1;

    // Default tasks with auto-assigned colors (each picks next unused)
    const defaultTasks = [
      { name: 'Demo', days: [0, 2] },
      { name: 'Plumbing Rough-In', days: [3, 5] },
      { name: 'Backer Board & Waterproofing', days: [8, 10] },
      { name: 'Tile Work', days: [11, 20] },
      { name: 'Fixture Install', days: [23, 24] },
      { name: 'Paint & Finish', days: [25, 26] },
      { name: 'Final Punch & Cleanup', days: [27, 27] }
    ];

    const phaseKeys = Object.keys(PHASE_COLORS);
    const tasks = defaultTasks.map(function(t, i) {
      return {
        name: t.name,
        owner: '',
        start: dateToStringHelper(addDays(startDate, t.days[0])),
        end: dateToStringHelper(addDays(startDate, t.days[1])),
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
      endDate: dateToStringHelper(endDate),
      tasks: tasks
    });
    saveState();
    renderPortfolio();
  }

  function dateToStringHelper(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  // ── Drag-to-resize bars ──
  let dragState = null;

  function dateToString(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  // ── Drag: resize (handles) + move (bar body) ──
  let dragStartTime = 0;
  let lastDragEnd = 0;

  document.addEventListener('mousedown', function(e) {
    // Check for handle first (resize), then bar body (move)
    const handle = e.target.closest('.drag-handle');
    const bar = handle ? handle.closest('.bar') : e.target.closest('.bar');
    if (!bar) return;

    const mode = handle ? handle.dataset.side : 'move'; // 'left', 'right', or 'move'
    const type = bar.dataset.type;

    e.preventDefault();
    e.stopPropagation();

    bar.classList.add('dragging');
    dragStartTime = Date.now();

    const isLevel1 = currentLevel === 1;
    const dayW = isLevel1 ? 14 : 48;

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

    const dx = e.clientX - dragState.startX;
    const dayDelta = Math.round(dx / dragState.dayWidth);
    const minWidth = dragState.dayWidth - 2;

    if (dragState.mode === 'move') {
      // Move entire bar
      dragState.bar.style.left = (dragState.origLeft + dayDelta * dragState.dayWidth) + 'px';
      dragState.currentDayDelta = dayDelta;
    } else if (dragState.mode === 'left') {
      const newLeft = dragState.origLeft + dayDelta * dragState.dayWidth;
      const newWidth = dragState.origWidth - dayDelta * dragState.dayWidth;
      if (newWidth >= minWidth) {
        dragState.bar.style.left = newLeft + 'px';
        dragState.bar.style.width = newWidth + 'px';
        dragState.currentDayDelta = dayDelta;
      }
    } else {
      const newWidth = dragState.origWidth + dayDelta * dragState.dayWidth;
      if (newWidth >= minWidth) {
        dragState.bar.style.width = newWidth + 'px';
        dragState.currentDayDelta = dayDelta;
      }
    }
  });

  document.addEventListener('mouseup', function(e) {
    if (!dragState) return;

    dragState.bar.classList.remove('dragging');

    const dayDelta = dragState.currentDayDelta || 0;
    const wasDrag = Date.now() - dragStartTime > 200 || Math.abs(dayDelta) > 0;

    // If no movement, treat as a click-through (don't block navigation)
    if (dayDelta === 0) {
      dragState = null;
      return;
    }

    lastDragEnd = Date.now();

    // Snapshot original state for revert
    const ds = dragState;
    const direction = dayDelta > 0 ? dayDelta + ' day' + (dayDelta > 1 ? 's' : '') + ' later' : Math.abs(dayDelta) + ' day' + (Math.abs(dayDelta) > 1 ? 's' : '') + ' earlier';

    function applyDrag() {
      if (ds.type === 'job') {
        const job = jobs.find(j => j.id === ds.jobId);
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
          renderPortfolio();
        }
      } else if (ds.type === 'task') {
        const job = jobs.find(j => j.id === ds.jobId);
        if (job && job.tasks[ds.taskIndex]) {
          const task = job.tasks[ds.taskIndex];
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
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;

    const bar = handle.closest('.bar');
    if (!bar) return;

    e.preventDefault();
    const touch = e.touches[0];
    const mode = handle.dataset.side;
    const type = bar.dataset.type;

    bar.classList.add('dragging');
    dragStartTime = Date.now();

    const isLevel1 = currentLevel === 1;
    const dayW = isLevel1 ? 14 : 48;

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

    const touch = e.touches[0];
    const dx = touch.clientX - dragState.startX;
    const dayDelta = Math.round(dx / dragState.dayWidth);
    const minWidth = dragState.dayWidth - 2;

    if (dragState.mode === 'left') {
      const newLeft = dragState.origLeft + dayDelta * dragState.dayWidth;
      const newWidth = dragState.origWidth - dayDelta * dragState.dayWidth;
      if (newWidth >= minWidth) {
        dragState.bar.style.left = newLeft + 'px';
        dragState.bar.style.width = newWidth + 'px';
        dragState.currentDayDelta = dayDelta;
      }
    } else {
      const newWidth = dragState.origWidth + dayDelta * dragState.dayWidth;
      if (newWidth >= minWidth) {
        dragState.bar.style.width = newWidth + 'px';
        dragState.currentDayDelta = dayDelta;
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', function(e) {
    if (!dragState || !dragState.isTouch) return;

    dragState.bar.classList.remove('dragging');
    const dayDelta = dragState.currentDayDelta || 0;

    if (dayDelta === 0) { dragState = null; return; }
    lastDragEnd = Date.now();

    const dsT = dragState;
    const dirT = dayDelta > 0 ? dayDelta + ' day' + (dayDelta > 1 ? 's' : '') + ' later' : Math.abs(dayDelta) + ' day' + (Math.abs(dayDelta) > 1 ? 's' : '') + ' earlier';

    function applyTouchDrag() {
      if (dsT.type === 'job') {
        const job = jobs.find(j => j.id === dsT.jobId);
        if (job) {
          if (dsT.mode === 'left') {
            job.startDate = dateToString(addDays(parseDate(job.startDate), dayDelta));
          } else {
            job.endDate = dateToString(addDays(parseDate(job.endDate), dayDelta));
          }
          saveState();
          renderPortfolio();
        }
      } else if (dsT.type === 'task') {
        const job = jobs.find(j => j.id === dsT.jobId);
        if (job && job.tasks[dsT.taskIndex]) {
          const task = job.tasks[dsT.taskIndex];
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
    const overlay = document.createElement('div');
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

  // ── Drag-to-create tasks on empty timeline area (Level 2 only) ──
  let createDrag = null;

  document.addEventListener('mousedown', function(e) {
    if (currentLevel !== 2 || !currentJobId) return;
    if (dragState) return; // existing bar drag in progress
    // Only trigger on row-track (empty area), not on bars or sidebar
    var track = e.target.closest('.row-track');
    if (!track) return;
    if (e.target.closest('.bar')) return;

    e.preventDefault();
    var dayWidth = 48;
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

    // Convert day offsets to actual dates
    var taskStart = addDays(infiniteState.rangeStart, minD);
    var taskEnd = addDays(infiniteState.rangeStart, maxD);

    var job = jobs.find(function(j) { return j.id === currentJobId; });
    if (!job) return;

    var taskName = prompt('Task name:', 'New Task');
    if (!taskName || !taskName.trim()) return;

    var usedColors = job.tasks.map(function(t) { return t.color; });
    var color = nextColor(usedColors);

    job.tasks.push({
      name: taskName.trim(),
      owner: '',
      start: dateToString(taskStart),
      end: dateToString(taskEnd),
      status: 'scheduled',
      color: color,
      notes: '',
      notesList: []
    });

    saveScrollPos();
    autoStaggerTasks(job);
    renderProject(currentJobId);
  });

  // ── Public API ──
  window.app = {
    showTimeline,
    showProjects,
    updateTaskStatus,
    closeDetail,
    deleteProject,
    deleteTask
  };

  // ── Init ──
  renderPortfolio();

})();
