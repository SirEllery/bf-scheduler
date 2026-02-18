// data.js — Bath Foundry sample project data
// Swap this file for API calls later

const PHASE_COLORS = {
  demo: '#e06c75',
  plumbing: '#61afef',
  electrical: '#e5c07b',
  backer: '#56b6c2',
  tile: '#98c379',
  fixture: '#c678dd',
  paint: '#d19a66',
  punch: '#be5046',
  other: '#abb2bf'
};

const JOB_COLORS = [
  '#61afef', '#98c379', '#e5c07b', '#c678dd',
  '#56b6c2', '#d19a66', '#e06c75', '#abb2bf',
  '#be5046', '#7ee787'
];

const SAMPLE_JOBS = [
  {
    id: 1,
    customer: "John Smith",
    type: "Master Bath Remodel",
    status: "active",
    startDate: "2026-01-12",
    endDate: "2026-02-06",
    tasks: [
      { name: "Demo", owner: "Crew A", start: "2026-01-12", end: "2026-01-14", status: "complete", color: "demo", notes: "" },
      { name: "Plumbing Rough-In", owner: "Mike (Sub)", start: "2026-01-15", end: "2026-01-17", status: "complete", color: "plumbing", notes: "" },
      { name: "Electrical", owner: "Dave (Sub)", start: "2026-01-15", end: "2026-01-16", status: "complete", color: "electrical", notes: "" },
      { name: "Backer Board & Waterproofing", owner: "Crew A", start: "2026-01-20", end: "2026-01-22", status: "complete", color: "backer", notes: "" },
      { name: "Tile Work", owner: "Crew A", start: "2026-01-23", end: "2026-01-31", status: "active", color: "tile", notes: "" },
      { name: "Fixture Install", owner: "Crew A", start: "2026-02-03", end: "2026-02-04", status: "scheduled", color: "fixture", notes: "" },
      { name: "Paint & Finish", owner: "Crew B", start: "2026-02-04", end: "2026-02-05", status: "scheduled", color: "paint", notes: "" },
      { name: "Final Punch & Cleanup", owner: "Kyle", start: "2026-02-06", end: "2026-02-06", status: "scheduled", color: "punch", notes: "" }
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
      { name: "Demo", owner: "Crew B", start: "2026-02-03", end: "2026-02-04", status: "complete", color: "demo", notes: "" },
      { name: "Plumbing Rough-In", owner: "Mike (Sub)", start: "2026-02-05", end: "2026-02-06", status: "active", color: "plumbing", notes: "" },
      { name: "Backer Board & Waterproofing", owner: "Crew B", start: "2026-02-09", end: "2026-02-10", status: "scheduled", color: "backer", notes: "" },
      { name: "Tile Work", owner: "Crew B", start: "2026-02-11", end: "2026-02-18", status: "scheduled", color: "tile", notes: "" },
      { name: "Fixture Install", owner: "Crew B", start: "2026-02-19", end: "2026-02-20", status: "scheduled", color: "fixture", notes: "" },
      { name: "Final Punch & Cleanup", owner: "Kyle", start: "2026-02-21", end: "2026-02-21", status: "scheduled", color: "punch", notes: "" }
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
      { name: "Demo", owner: "Crew A", start: "2026-03-02", end: "2026-03-04", status: "scheduled", color: "demo", notes: "" },
      { name: "Plumbing Rough-In", owner: "Mike (Sub)", start: "2026-03-05", end: "2026-03-07", status: "scheduled", color: "plumbing", notes: "" },
      { name: "Electrical", owner: "Dave (Sub)", start: "2026-03-05", end: "2026-03-06", status: "scheduled", color: "electrical", notes: "" },
      { name: "Backer Board & Waterproofing", owner: "Crew A", start: "2026-03-10", end: "2026-03-12", status: "scheduled", color: "backer", notes: "" },
      { name: "Tile Work", owner: "Crew A", start: "2026-03-13", end: "2026-03-21", status: "scheduled", color: "tile", notes: "" },
      { name: "Fixture Install", owner: "Crew A", start: "2026-03-24", end: "2026-03-25", status: "scheduled", color: "fixture", notes: "" },
      { name: "Paint & Finish", owner: "Crew B", start: "2026-03-25", end: "2026-03-26", status: "scheduled", color: "paint", notes: "" },
      { name: "Final Punch & Cleanup", owner: "Kyle", start: "2026-03-27", end: "2026-03-27", status: "scheduled", color: "punch", notes: "" }
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
      { name: "Demo", owner: "Crew B", start: "2026-03-16", end: "2026-03-17", status: "scheduled", color: "demo", notes: "" },
      { name: "Plumbing Rough-In", owner: "Mike (Sub)", start: "2026-03-18", end: "2026-03-19", status: "scheduled", color: "plumbing", notes: "" },
      { name: "Backer Board & Waterproofing", owner: "Crew B", start: "2026-03-20", end: "2026-03-21", status: "scheduled", color: "backer", notes: "" },
      { name: "Tile Work", owner: "Crew B", start: "2026-03-23", end: "2026-03-31", status: "scheduled", color: "tile", notes: "" },
      { name: "Fixture Install", owner: "Crew B", start: "2026-04-01", end: "2026-04-02", status: "scheduled", color: "fixture", notes: "" },
      { name: "Final Punch & Cleanup", owner: "Kyle", start: "2026-04-03", end: "2026-04-03", status: "scheduled", color: "punch", notes: "" }
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
      { name: "Demo", owner: "Crew A", start: "2025-12-08", end: "2025-12-10", status: "complete", color: "demo", notes: "" },
      { name: "Plumbing Rough-In", owner: "Mike (Sub)", start: "2025-12-11", end: "2025-12-13", status: "complete", color: "plumbing", notes: "" },
      { name: "Electrical", owner: "Dave (Sub)", start: "2025-12-11", end: "2025-12-12", status: "complete", color: "electrical", notes: "" },
      { name: "Backer Board & Waterproofing", owner: "Crew A", start: "2025-12-16", end: "2025-12-18", status: "complete", color: "backer", notes: "" },
      { name: "Tile Work", owner: "Crew A", start: "2025-12-19", end: "2026-01-03", status: "complete", color: "tile", notes: "" },
      { name: "Fixture Install", owner: "Crew A", start: "2026-01-06", end: "2026-01-07", status: "complete", color: "fixture", notes: "" },
      { name: "Paint & Finish", owner: "Crew B", start: "2026-01-07", end: "2026-01-08", status: "complete", color: "paint", notes: "" },
      { name: "Final Punch & Cleanup", owner: "Kyle", start: "2026-01-09", end: "2026-01-09", status: "complete", color: "punch", notes: "" }
    ]
  }
];
