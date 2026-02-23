/**
 * patches.js
 * The patch catalog. This is the single source of truth for all available patches.
 * Add new patches here — the UI and bookmarklet generator will pick them up automatically.
 */

const PATCH_CATALOG = [
  {
    id: "minimal-dashboard",
    name: "Minimal Dashboard",
    description: "Hides announcement panels and sidebar widgets so you only see your course feed.",
    rules: [
      { type: "hide", selector: ".s-edge-feed-item-container .announcement-view" },
      { type: "hide", selector: "#right-column-inner .widget-container" },
      { type: "css",  selector: "#center-column", styles: "max-width:860px;margin:0 auto;" }
    ]
  },
  {
    id: "dark-sidebar",
    name: "Dark Sidebar",
    description: "Applies a dark background to the left navigation sidebar for a focused look.",
    rules: [
      { type: "css", selector: "#left-column-inner",     styles: "background:#1a1a2e;border-radius:8px;padding:8px;" },
      { type: "css", selector: "#left-column-inner a",   styles: "color:#e0e0e0!important;" }
    ]
  },
  {
    id: "focus-grades",
    name: "Focus: Grades Only",
    description: "On the grades page, hides teacher comments and period labels for a clean summary.",
    rules: [
      { type: "hide", selector: ".comment-body" },
      { type: "hide", selector: ".period-title" },
      { type: "css",  selector: ".gradebook-course-grades tr", styles: "line-height:2;" }
    ]
  },
  {
    id: "compact-nav",
    name: "Compact Navigation",
    description: "Shrinks the top navigation bar height to reclaim vertical screen space.",
    rules: [
      { type: "css",  selector: "#top-bar",       styles: "height:44px!important;min-height:44px!important;" },
      { type: "css",  selector: "#top-bar .logo", styles: "height:32px;" },
      { type: "hide", selector: "#school-switcher" }
    ]
  },
  {
    id: "high-contrast-assignments",
    name: "High Contrast Assignments",
    description: "Overdue assignments get a red left border; upcoming get green — instantly scannable.",
    rules: [
      { type: "css", selector: ".overdue-assignment,.assignment-row.overdue",   styles: "border-left:4px solid #e53935!important;padding-left:8px;" },
      { type: "css", selector: ".upcoming-assignment,.assignment-row.upcoming", styles: "border-left:4px solid #43a047!important;padding-left:8px;" }
    ]
  },
  {
    id: "hide-social-feed",
    name: "Hide Social Feed",
    description: "Removes the social/updates feed from the dashboard entirely.",
    rules: [
      { type: "hide", selector: ".s-edge-feed" },
      { type: "hide", selector: ".home-feed-wrapper .create-post" },
      { type: "css",  selector: "#content-wrapper", styles: "max-width:100%;" }
    ]
  },
  {
    id: "readable-content",
    name: "Readable Content",
    description: "Increases font size and line height in course content areas for easier reading.",
    rules: [
      { type: "css", selector: ".material-content,.s-user-generated-content", styles: "font-size:15px!important;line-height:1.75!important;" },
      { type: "css", selector: ".course-period-title", styles: "font-size:18px!important;font-weight:600!important;" }
    ]
  }
];
