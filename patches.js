/**
 * patches.js
 * Patch catalog — selectors verified against real Schoology DOM (henrico.schoology.com).
 *
 * Confirmed structure from DevTools inspection:
 *   Nav bar:          #header.site-navigation
 *   Page wrapper:     #wrapper > #container > #main-content-wrapper
 *   Feed:             .feed > .item-list > ul.s-edge-feed
 *   Each post:        li[id^="edge-assoc-"] > .s-edge-type-update-post > .edge-item
 *   Post attribution: .edge-main-wrapper > .edge-sentence
 *   Post body:        .update-body.s-rte
 *   Post footer:      .edge-footer
 *   To Do sidebar:    #right-column  (role="complementary")
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
    description: "Nukes everything except the nav bar — no feed, no To Do, no footer. Pure blank.",
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
    description: "Strips embedded images from posts — loads faster, less visual noise.",
    rules: [
      { type: "hide", selector: ".update-body.s-rte img" },
      { type: "hide", selector: ".update-body.s-rte p:empty" }
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
    description: "Removes Like, Comment, and Share buttons and the ... menu from every post.",
    rules: [
      { type: "hide", selector: ".edge-footer" },
      { type: "hide", selector: ".edge-sentence-actions" }
    ]
  },

  {
    id: "mute-post-metadata",
    name: "Mute Post Metadata",
    description: "Dims the 'Posted to JRT 12th Grade' attribution line so post content stands out.",
    rules: [
      { type: "css", selector: ".edge-sentence", styles: "opacity:0.4!important;font-size:11px!important;" },
      { type: "css", selector: ".edge-left",     styles: "opacity:0.45!important;" }
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
