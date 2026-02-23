/**
 * patches.js
 * Patch catalog — selectors verified against real Schoology DOM (henrico.schoology.com).
 *
 * Confirmed structure from DevTools inspection:
 *   Nav bar:          #header.site-navigation
 *   Page wrapper:     #wrapper > #container > #main-content-wrapper
 *   Feed:             .feed > .item-list > ul.s-edge-feed
 *   Each post:        li[id^="edge-assoc-"] > .s-edge-type-update-post > .edge-item
 *   Post avatar:      .edge-left img   ← do NOT hide these
 *   Post attribution: .edge-sentence   (e.g. "Javaria Masroor → JRT 12th Grade")
 *   Post body:        .update-body.s-rte  (text + embedded images)
 *   Post footer:      .edge-footer     (Like · Comment · timestamp)
 *   To Do sidebar:    #right-column
 *   Page footer:      #footer, #bottom-bar, #site-navigation-footer
 */

const PATCH_CATALOG = [
  {
    id: "hide-social-feed",
    name: "Hide Social Feed",
    description: "Hides the entire Recent Activity post feed. The To Do sidebar stays visible.",
    rules: [
      { type: "hide", selector: "ul.s-edge-feed" },
      { type: "hide", selector: ".s-tabbed-navigation-tabs" },
      { type: "hide", selector: ".nav-tabs" }
    ]
  },

  {
    id: "hide-todo-sidebar",
    name: "Hide To Do Sidebar",
    description: "Removes the To Do / overdue panel on the right so only the feed is visible.",
    rules: [
      { type: "hide", selector: "#right-column" }
    ]
  },

  {
    id: "focus-mode",
    name: "Focus Mode",
    description: "Removes feed, To Do sidebar, and footer — leaves only the nav bar.",
    rules: [
      { type: "hide", selector: "ul.s-edge-feed" },
      { type: "hide", selector: ".s-tabbed-navigation-tabs" },
      { type: "hide", selector: ".nav-tabs" },
      { type: "hide", selector: "#right-column" },
      { type: "hide", selector: "#footer" },
      { type: "hide", selector: "#bottom-bar" },
      { type: "hide", selector: "#site-navigation-footer" }
    ]
  },

  {
    id: "hide-post-images",
    name: "Hide Feed Images",
    description: "Strips embedded images from post bodies only — profile avatars are kept.",
    rules: [
      // .update-body.s-rte is the post body text area only — does NOT include avatars
      // Avatars live in .edge-left which is a sibling, not a child of .update-body
      { type: "hide", selector: ".update-body.s-rte img" },
      // Also hide the empty <p> spacers that images leave behind
      { type: "css", selector: ".update-body.s-rte p:has(img)", styles: "display:none!important;" }
    ]
  },

  {
    id: "compact-posts",
    name: "Compact Feed",
    description: "Tightens padding on post cards so more content fits on screen.",
    rules: [
      { type: "css", selector: ".edge-item",         styles: "padding:8px 10px!important;" },
      { type: "css", selector: ".edge-footer",       styles: "padding:4px 10px!important;" },
      { type: "css", selector: ".edge-main-wrapper", styles: "padding:6px 0!important;" }
    ]
  },

  {
    id: "compact-nav",
    name: "Compact Navigation Bar",
    description: "Shrinks the top navigation bar height to reclaim vertical space.",
    rules: [
      { type: "css", selector: "#header",            styles: "min-height:48px!important;" },
      { type: "css", selector: "#header .logo-main", styles: "height:30px!important;" },
      { type: "css", selector: "#wrapper",           styles: "padding-top:0!important;" }
    ]
  },

  {
    id: "hide-post-actions",
    name: "Hide Post Action Buttons",
    description: "Removes Like, Comment, timestamp row and the ··· menu from every post.",
    rules: [
      // .edge-footer: the bottom row of each post (timestamp · Like · Comment)
      { type: "hide", selector: ".edge-footer" },
      // .edge-sentence-actions: the ··· overflow menu button on each post
      { type: "hide", selector: ".edge-sentence-actions" }
    ]
  },

  {
    id: "mute-post-metadata",
    name: "Mute Post Metadata",
    description: "Strongly dims the 'Teacher → Group' attribution line on every post.",
    rules: [
      // .edge-sentence wraps "Javaria Masroor → JRT 12th Grade"
      { type: "css", selector: ".edge-sentence",       styles: "opacity:0.25!important;font-size:11px!important;line-height:1.2!important;" },
      // .edge-left is the avatar column — dim it to match
      { type: "css", selector: ".edge-left",           styles: "opacity:0.3!important;" },
      // Also shrink the avatar so the post body gets more space
      { type: "css", selector: ".edge-left img",       styles: "width:28px!important;height:28px!important;" }
    ]
  },

  {
    id: "hide-footer",
    name: "Hide Page Footer",
    description: "Removes the Schoology footer and bottom bar for a cleaner page.",
    rules: [
      { type: "hide", selector: "#footer" },
      { type: "hide", selector: "#bottom-bar" },
      { type: "hide", selector: "#site-navigation-footer" }
    ]
  }
];


// ── NEW PATCHES: additive, highlight, move ────────────────────────────────

PATCH_CATALOG.push(
  {
    id: "agenda-panel",
    name: "📅 Agenda Panel",
    description: "Adds a new 'Agenda' tab next to Recent Activity. Scrapes your To Do list and feed posts to build a unified event + assignment view.",
    rules: [
      { type: "agenda" }
    ]
  },

  {
    id: "highlight-overdue",
    name: "Highlight Overdue Items",
    description: "Draws a bold red accent on every overdue assignment row in the To Do sidebar.",
    rules: [
      {
        type: "highlight",
        selector: "#right-column .overdue-header ~ li, #right-column [class*='overdue'], #right-column li:has(.overdue)",
        color: "#e53935",
        bg: "rgba(229,57,53,0.06)"
      }
    ]
  },

  {
    id: "highlight-upcoming",
    name: "Highlight Upcoming Due Soon",
    description: "Adds a blue accent to upcoming assignments due within the next few days.",
    rules: [
      {
        type: "highlight",
        selector: "#right-column .upcoming-item, #right-column li.upcoming",
        color: "#1c458e",
        bg: "rgba(28,69,142,0.05)"
      }
    ]
  },

  {
    id: "move-todo-above-feed",
    name: "Move To Do Above Feed",
    description: "Relocates the To Do sidebar to sit above the activity feed instead of beside it, so assignments are always front and center.",
    rules: [
      {
        type: "move",
        selector: "#right-column",
        target: "#content-wrapper",
        position: "prepend"
      },
      {
        type: "css",
        selector: "#right-column",
        styles: "width:100%;max-width:100%;margin-bottom:20px;float:none;"
      },
      {
        type: "css",
        selector: "#center-wrapper",
        styles: "float:none;width:100%;"
      }
    ]
  },

  {
    id: "inject-greeting",
    name: "Personalized Header",
    description: "Injects a friendly time-based greeting ('Good morning!') at the top of the content area.",
    rules: [
      {
        type: "inject",
        target: "#content-wrapper",
        position: "afterbegin",
        once: true,
        html: (function() {
          var h = new Date().getHours();
          var greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
          return '<div style="font-size:22px;font-weight:700;color:#1c458e;padding:16px 0 8px;font-family:sans-serif;">' + greeting + ' \uD83D\uDC4B</div>';
        })()
      }
    ]
  }
);
