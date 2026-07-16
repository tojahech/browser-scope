# BrowserScope

A keyboard-driven fuzzy finder for the browser, inspired by [telescope.nvim](https://github.com/nvim-telescope/telescope.nvim).

## Core user flow

- Core user flow
  1. User presses the launch shortcut (`Ctrl+Space` by default).
  2. Popup opens with a search box and a results list, the search input is focused.
  3. User enters what they're looking for, results update with fuzzy matching across tabs, bookmarks, and history.
  4. User moves the selection with `Ctrl+j` / `Ctrl+k` (or arrow keys) and confirms with `Enter`.
  5. Popup closes and switches or opens a tab depending on the selection.

## Details

- Search behaviour
  - Sources
    - Open tabs (all tabs across all open windows)
    - Bookmarks (all bookmarks)
    - History
  - Empty search shows open tabs in most recently used order
  - Fuzzy matching (fzf-style) against page title and URL
  - Matched characters highlighted in the result
  - Matching is case-insensitive
  - If the same URL exists in multiple places, it appears once labelled by its highest-rank source
  - Ranking
    - Ranking is represented as a number between 0 and 1
    - Ranking depends on:
      1. **Match quality** — How close is the fuzzy match?
      2. **Source** — Each result is multiplied by a discount weight depending on the source. Open tabs weight higher than bookmarks weight higher than history

- Quick switch
  - Pressing the launch shortcut **twice in quick succession** switches to the previously focused tab

- UI
  - Keep interface minimal
  - Popup appears in the center of the browser window, overlaying page content.
    - Vertical height ~80%
    - Horizontal 600px
  - Popup features an input text box at top and a list of results below
  - Results list
    - Small icon to indicate the type of result (tab / bookmark / history)
    - Page title in bold, with matched characters highlighted.
    - URL shown below
    - Selected row is distinguished
  - Mouse click on a row also activates it (convenience, not a design focus).

- Theming
  - In Firefox, match the browser theme
  - In Chrome, fall back to a default palette.
  - Typography and spacing should match browser UI conventions (system font stack, compact rows).

- Configuration
  - All global constants defined in a single configuration file
  - Launch hotkey exposed to the user as a configuration option via the browser extension's shortcut settings + extension options

- Hotkeys / Keybindings
  - Defined in a single file
  - Global
    - `Ctrl+Space` - Launch the popup window
      - Double tap switches to previous tab
  - Inside the popup
    - `Ctrl+j` / `↓` - Move selection down
    - `Ctrl+k` / `↑` - Move selection up
    - `Enter` - Action selected result
    - `Ctrl+Enter` - Search the raw query text with the browser's default search engine in a new tab
    - `Esc` - Close popup window

## Non-functional requirements

- Performance, every interaction should feel smooth
- The plugin should feel like part of the browser itself

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
