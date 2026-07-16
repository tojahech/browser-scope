# BrowserScope

A keyboard-driven fuzzy finder for the browser, inspired by [telescope.nvim](https://github.com/nvim-telescope/telescope.nvim).

## Features

- Instant, keyboard-only navigation **between** tabs, windows, bookmarks, and history.
- Core user flow
  1. User presses the launch shortcut (`Ctrl+Space` by default).
  2. Popup opens with the search input focused.
  3. **Empty query:** results list shows open tabs in MRU (most-recently-used).
  4. As the user types, results update live with fuzzy matching across tabs, bookmarks, and history.
  5. User moves the selection with `Ctrl+j` / `Ctrl+k` (or arrow keys) and confirms with `Enter`.
  6. Popup closes and focus actions the selected item.
  - Switch to open tab
  - Open bookmark or history in a new tab
- Search behaviour
  - Sources
    - Open tabs (all tabs across all open windows)
    - Bookmarks (all bookmarks)
    - History (last `HISTORY_WINDOW_DAYS` days)
  - Fuzzy matching (fzf-style) against page title and URL
  - Matched characters highlighted in the result
  - Matching is case-insensitive
  - Ranking
    1. **Source weight** — open tabs rank above bookmarks, which rank above history.
    2. **Match quality** — closeness of the fuzzy match (consecutive characters, word-boundary hits, match position, ratio of query length to target length).
  - If the same URL exists in multiple places, it appears once labelled by its highest-priority source.
- MRU quick-switch
  - Pressing the launch shortcut **twice in quick succession** switches to the previously _active_ tab (true MRU, like Alt-Tab), without needing to interact with the list. Pressing it again bounces back — enabling rapid two-tab toggling.
  - Mechanic: first press opens the popup; a second press within the double-tap threshold closes it and performs the MRU switch.
- Configuration
  - All global constants defined in a single configuration file
  - Launch hotkey exposed to the user as a configuration option via the browser extension's shortcut settings + extension options
- Hotkeys / Keybindings
  - Defined in a single file
  - Global
    - `Ctrl+Space` launches the popup window
      - Double tap switches to previous tab
  - Inside the popup
    - `Ctrl+j` / `↓` | Move selection down
    - `Ctrl+k` / `↑` | Move selection up
    - `Enter` | Action selected result
    - `Ctrl+Enter` | Search the raw query text with the browser's **default search engine**, in a **new foreground tab**
    - `Esc` | Close popup window
- UI
  - Keep interface minimal
  - Input text box at top, results below
  - Each row: **type indicator** (tab / bookmark / history — small icon or letter badge) + **page title** with matched characters highlighted.
  - Now URLs, favicons, or window labels
  - Visible results capped at `MAX_VISIBLE_RESULTS` (default **10**); list scrolls with selection.
  - Selected row is clearly distinguished (background highlight).
  - Mouse click on a row also activates it (convenience, not a design focus).
- Browser plugin lives inside a toolbar popup
  - Using native extension API
  - Opened via a keyboard shortcut
- Feels native
  - Incorporate browser theme
  - High performance, smooth and fast
- Theming
  - Read active theme using `theme.getCurrent()` and derive popup background, text, accent/highlight, and border colours.
  - In Chrome, fall back to a default palette.
  - Typography and spacing should match browser UI conventions (system font stack, compact rows).

## Non-functional requirements

- Performance, every interaction should feel instantaneous

## Target platforms

Firefox is the primary platform.
Chrome / Chromium is a secondary target.
Desktop browsers only, mobile isn't a consideration.

## Tech Stack

- Typescript throughout
- Use `mise` to install dev tools and as a task runner
- Use `pnpm` for package management
- Use `wxt` as a browser plugin framework
- Use `biome` for linting and formatting
- Use `solid` as a reactive framework
- Use `vitest` for testing
