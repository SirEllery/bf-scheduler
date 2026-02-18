# Bath Foundry — Project Timeline (Gantt Board)

## Overview
A dark-mode, timeline-based project management board for Bath Foundry remodel jobs. Three levels of drill-down: portfolio → project → task.

**Stack:** Standalone HTML/CSS/JS. No frameworks, no build tools. Single `index.html` + supporting files. Must work by opening `index.html` directly or from a simple static server.

## Design

### Theme — Dark Mode
- Background: `#0d1117` (GitHub dark style)
- Surface: `#161b22`
- Borders: `#30363d`
- Text primary: `#e6edf3`
- Text secondary: `#8b949e`
- No harsh neons. Warm, welcoming, easy on the eyes.

### Color Palette for Phases/Tasks
Soft, friendly pastels that pop on dark backgrounds:
- **Demo:** `#e06c75` (soft coral red)
- **Plumbing Rough-In:** `#61afef` (calm blue)
- **Electrical:** `#e5c07b` (warm amber)
- **Backer Board / Waterproofing:** `#56b6c2` (teal)
- **Tile Work:** `#98c379` (sage green)
- **Fixture Install:** `#c678dd` (soft purple)
- **Paint / Finish:** `#d19a66` (warm orange)
- **Final Punch / Cleanup:** `#be5046` (muted red)
- **Custom/Other:** `#abb2bf` (neutral grey)

Job bars on the 6-month view get a unique color per job (cycle through a set of 8-10 friendly colors).

### Level 1 — Portfolio View (6-Month Timeline)
- **Default view on load**
- Horizontal timeline spanning 6 months (scrollable if needed)
- Month labels across the top with week gridlines
- Each job = a horizontal bar on its own row
- Bar label: **"Customer Name — Job Type"** (e.g., "John Smith — Master Bath Remodel")
- Bar length = job duration (typically ~4 weeks, but variable)
- Jobs stacked vertically, sorted by start date
- Status indicator on each bar:
  - 🟢 Active (in progress)
  - 🟡 Scheduled (upcoming)  
  - ✅ Completed (greyed/faded)
- Hover: show tooltip with start date, end date, progress %
- **Click a job bar → drill into Level 2**
- "Today" marker = vertical red dashed line

### Level 2 — Project View (Single Job)
- **Breadcrumb nav:** Portfolio > John Smith — Master Bath Remodel
- Timeline zooms to show just this project's duration (+ 1 week padding each side)
- Each **phase/task** gets its own horizontal row
- Task bars show:
  - Task name on the bar
  - Color-coded by phase type (see palette above)
  - Duration represented by bar length
  - Dependencies shown as subtle arrows between tasks (if sequential)
- Left sidebar: task list with status icons
- **Click a task bar → drill into Level 3**
- "Today" marker persists

### Level 3 — Task Detail View
- **Breadcrumb:** Portfolio > John Smith — Master Bath Remodel > Tile Work
- Timeline zooms to just this task's duration
- Detail panel (right side or overlay) showing:
  - **Task name**
  - **Owner/Assigned to** (crew member or sub name)
  - **Start date / End date**
  - **Duration** (X days)
  - **Status:** Not Started / In Progress / Complete
  - **Notes:** free text area
  - **Dependencies:** what must finish before this starts
- Editable fields (local state for now — no backend persistence yet)

### Navigation
- Breadcrumb trail at top for drill-down context
- Back button / click breadcrumb to go up a level
- Smooth zoom animation when drilling in/out (CSS transitions)

### Interactions
- Click to drill down
- Breadcrumb to go back up
- Hover for tooltips
- Scroll horizontally on timeline
- Mouse wheel zoom on timeline (optional, nice-to-have)

## Sample Data
Include 4-5 sample jobs spanning ~4 months:

```javascript
const SAMPLE_JOBS = [
  {
    id: 1,
    customer: "John Smith",
    type: "Master Bath Remodel",
    status: "active",
    startDate: "2026-01-12",
    endDate: "2026-02-06",
    tasks: [
      { name: "Demo", owner: "Crew A", start: "2026-01-12", end: "2026-01-14", status: "complete", color: "demo" },
      { name: "Plumbing Rough-In", owner: "Mike (Sub)", start: "2026-01-15", end: "2026-01-17", status: "complete", color: "plumbing" },
      { name: "Electrical", owner: "Dave (Sub)", start: "2026-01-15", end: "2026-01-16", status: "complete", color: "electrical" },
      { name: "Backer Board & Waterproofing", owner: "Crew A", start: "2026-01-20", end: "2026-01-22", status: "complete", color: "backer" },
      { name: "Tile Work", owner: "Crew A", start: "2026-01-23", end: "2026-01-31", status: "active", color: "tile" },
      { name: "Fixture Install", owner: "Crew A", start: "2026-02-03", end: "2026-02-04", status: "scheduled", color: "fixture" },
      { name: "Paint & Finish", owner: "Crew B", start: "2026-02-04", end: "2026-02-05", status: "scheduled", color: "paint" },
      { name: "Final Punch & Cleanup", owner: "Kyle", start: "2026-02-06", end: "2026-02-06", status: "scheduled", color: "punch" }
    ]
  },
  {
    id: 2,
    customer: "Sarah Johnson",
    type: "Hall Bath Remodel",
    status: "active",
    startDate: "2026-02-03",
    endDate: "2026-02-21",
    tasks: [
      { name: "Demo", owner: "Crew B", start: "2026-02-03", end: "2026-02-04", status: "complete", color: "demo" },
      { name: "Plumbing Rough-In", owner: "Mike (Sub)", start: "2026-02-05", end: "2026-02-06", status: "active", color: "plumbing" },
      { name: "Backer Board & Waterproofing", owner: "Crew B", start: "2026-02-09", end: "2026-02-10", status: "scheduled", color: "backer" },
      { name: "Tile Work", owner: "Crew B", start: "2026-02-11", end: "2026-02-18", status: "scheduled", color: "tile" },
      { name: "Fixture Install", owner: "Crew B", start: "2026-02-19", end: "2026-02-20", status: "scheduled", color: "fixture" },
      { name: "Final Punch & Cleanup", owner: "Kyle", start: "2026-02-21", end: "2026-02-21", status: "scheduled", color: "punch" }
    ]
  },
  {
    id: 3,
    customer: "Robert Chen",
    type: "Master Bath Remodel",
    status: "scheduled",
    startDate: "2026-03-02",
    endDate: "2026-03-27",
    tasks: [
      { name: "Demo", owner: "Crew A", start: "2026-03-02", end: "2026-03-04", status: "scheduled", color: "demo" },
      { name: "Plumbing Rough-In", owner: "Mike (Sub)", start: "2026-03-05", end: "2026-03-07", status: "scheduled", color: "plumbing" },
      { name: "Electrical", owner: "Dave (Sub)", start: "2026-03-05", end: "2026-03-06", status: "scheduled", color: "electrical" },
      { name: "Backer Board & Waterproofing", owner: "Crew A", start: "2026-03-10", end: "2026-03-12", status: "scheduled", color: "backer" },
      { name: "Tile Work", owner: "Crew A", start: "2026-03-13", end: "2026-03-21", status: "scheduled", color: "tile" },
      { name: "Fixture Install", owner: "Crew A", start: "2026-03-24", end: "2026-03-25", status: "scheduled", color: "fixture" },
      { name: "Paint & Finish", owner: "Crew B", start: "2026-03-25", end: "2026-03-26", status: "scheduled", color: "paint" },
      { name: "Final Punch & Cleanup", owner: "Kyle", start: "2026-03-27", end: "2026-03-27", status: "scheduled", color: "punch" }
    ]
  },
  {
    id: 4,
    customer: "Lisa Martinez",
    type: "Shower Only Remodel",
    status: "scheduled",
    startDate: "2026-03-16",
    endDate: "2026-04-03",
    tasks: [
      { name: "Demo", owner: "Crew B", start: "2026-03-16", end: "2026-03-17", status: "scheduled", color: "demo" },
      { name: "Plumbing Rough-In", owner: "Mike (Sub)", start: "2026-03-18", end: "2026-03-19", status: "scheduled", color: "plumbing" },
      { name: "Backer Board & Waterproofing", owner: "Crew B", start: "2026-03-20", end: "2026-03-21", status: "scheduled", color: "backer" },
      { name: "Tile Work", owner: "Crew B", start: "2026-03-23", end: "2026-03-31", status: "scheduled", color: "tile" },
      { name: "Fixture Install", owner: "Crew B", start: "2026-04-01", end: "2026-04-02", status: "scheduled", color: "fixture" },
      { name: "Final Punch & Cleanup", owner: "Kyle", start: "2026-04-03", end: "2026-04-03", status: "scheduled", color: "punch" }
    ]
  },
  {
    id: 5,
    customer: "Tom & Amy Wilson",
    type: "Master Bath Remodel",
    status: "completed",
    startDate: "2025-12-08",
    endDate: "2026-01-09",
    tasks: [
      { name: "Demo", owner: "Crew A", start: "2025-12-08", end: "2025-12-10", status: "complete", color: "demo" },
      { name: "Plumbing Rough-In", owner: "Mike (Sub)", start: "2025-12-11", end: "2025-12-13", status: "complete", color: "plumbing" },
      { name: "Electrical", owner: "Dave (Sub)", start: "2025-12-11", end: "2025-12-12", status: "complete", color: "electrical" },
      { name: "Backer Board & Waterproofing", owner: "Crew A", start: "2025-12-16", end: "2025-12-18", status: "complete", color: "backer" },
      { name: "Tile Work", owner: "Crew A", start: "2025-12-19", end: "2026-01-03", status: "complete", color: "tile" },
      { name: "Fixture Install", owner: "Crew A", start: "2026-01-06", end: "2026-01-07", status: "complete", color: "fixture" },
      { name: "Paint & Finish", owner: "Crew B", start: "2026-01-07", end: "2026-01-08", status: "complete", color: "paint" },
      { name: "Final Punch & Cleanup", owner: "Kyle", start: "2026-01-09", end: "2026-01-09", status: "complete", color: "punch" }
    ]
  }
];
```

## Technical Notes
- Pure vanilla JS. No React, no Vue, no build step.
- CSS Grid or Flexbox for timeline layout.
- Smooth CSS transitions for drill-down animations.
- LocalStorage for any edits (task notes, status changes) until we add a backend.
- Mobile-friendly (responsive) — Kyle checks things on his phone.
- Performance: must be snappy. No heavy libraries. Keep it lean.

## File Structure
```
kanban/
  index.html
  style.css
  app.js
  data.js        (sample data, later swapped for API)
```

## Future (Not Now)
- Plutio API integration for real job data
- Drag to reschedule tasks
- Add/remove jobs and tasks
- Export to PDF
- Crew workload view (see who's assigned where across all jobs)
