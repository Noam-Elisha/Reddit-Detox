# Reddit Detox

A Chrome extension that helps you take control of your Reddit experience. No login required — just install and browse. All features are enabled by default and can be toggled from the extension popup.

## Features

### Disable Recommendations
Filters out posts from subreddits you're not subscribed to, keeping your home feed focused on communities you've chosen to follow.

### Disable Promoted Posts
Removes all promoted and sponsored posts from your feed and sidebar.

### Slide to See Post
Adds a slider overlay to each post in your feed. Posts are hidden until you deliberately slide to reveal them, adding a moment of intention before consuming content. Only active on feed pages — not when viewing a post directly.

### Disable Right Sidebar
Removes the right sidebar on the home page, including recent posts, sidebar ads, and other distractions.

### Disable Left Panel
Removes the left navigation sidebar entirely for a cleaner, less stimulating layout.

### Disable Related Communities
Hides the "Related Communities" recommendations that appear in-feed when browsing a subreddit.

### Disable Subreddit Sidebar *(off by default)*
Hides the right sidebar (rules, wiki, community info) when browsing a subreddit directly.

### Add Friction
Displays a configurable delay overlay before Reddit loads, giving you a moment to reconsider. Options include:
- **Delay duration** — 1 to 60 seconds
- **Trigger** — home page only, post pages only, or all pages
- **CAPTCHA** — optionally require a slider puzzle to proceed

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode**
4. Click **Load unpacked** and select the project folder

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript, HTML, CSS
- Chrome Storage Sync API for persistent settings
- MutationObserver for Reddit's SPA navigation
