# BrowserScope

A keyboard-driven fuzzy finder for Firefox and Chromium, built with WXT, Solid, and TypeScript.

Press **Ctrl+Space** to search your browser. Press it twice within 300 ms to switch to the previously focused tab. The empty query shows open tabs in most recently used order, across all windows.

| Key | Action |
| --- | --- |
| Ctrl+J / ↓ | Select next result |
| Ctrl+K / ↑ | Select previous result |
| Enter | Switch to the selected tab or open the result |
| Ctrl+Enter | Search the raw query with the browser’s default engine in a new tab |
| Esc | Close and restore page focus |

Clicking a result also opens it. The extension options show the assigned launch shortcut; Firefox supports editing/resetting it there. Both browsers also expose extension shortcut settings. OS-reserved shortcuts may require reassignment.

## Development

```sh
mise install
pnpm install
mise run dev
```

`pnpm dev:chrome` starts Chromium development. `mise run check` runs Biome, TypeScript, and Vitest. `mise run build` builds both browsers; `mise run zip` packages both.

## Load the MVP

- **Firefox:** run `pnpm build`, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `.output/firefox-mv2/manifest.json`. Temporary installations last until Firefox restarts.
- **Chromium:** run `pnpm build:chrome`, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose `.output/chrome-mv3`.

Refresh existing web pages after installing or reloading the extension to attach its content script. Open the finder with the launch shortcut or toolbar button.

## Search and implementation

The finder takes a fresh snapshot on each open: all tabs, the full bookmark tree, and up to the 10,000 most recent history entries. Fuzzy matching is case-insensitive across title and URL. Dynamic programming rewards contiguous matches and word boundaries, and supplies highlight positions. Scores are normalized to 0–1 and multiplied by source weights: tabs 1, bookmarks 0.85, history 0.65. Identical URLs appear once, preferring tabs, then bookmarks, then history; duplicate tabs select the most recently used instance. All titles for a URL remain searchable: a match on a bookmark title can activate an existing tab, with highlights shown on the matching title. Up to 100 results are rendered.

Search runs locally. No analytics, remote search service, or external assets are used. The tabs, bookmarks, and history permissions provide the search sources; storage preserves tab ordering across background worker restarts; search uses the configured browser engine; Firefox’s theme permission reads popup colors. A content script on eligible pages hosts the overlay in a closed shadow root with isolated styles and keyboard events.

- `lib/config.ts`: shared limits, timings, default shortcut, and ranking weights.
- `lib/keybindings.ts`: finder key mappings and selection behavior.
- `lib/types.ts`: discriminated source records, URL groups, and activation targets.
- `lib/fuzzy.ts`, `lib/search.ts`, `lib/highlight.ts`: pure matching, URL grouping/ranking, and highlight segmentation.
- `lib/sources.ts`: source snapshots with partial-failure warnings.
- `lib/actions.ts`: tab activation and default-engine search; the caller owns UI closing.
- `lib/mru.ts`: initialization, serialized updates, and persistence of tab recency.
- `lib/launcher.ts`: launch sequencing, double-tap switching, and fallback-window state.
- `lib/theme.ts`, `lib/firefox.ts`: theme conversion and Firefox API compatibility.
- `lib/messages.ts`: request-to-response types, runtime request validation, and error replies.
- `entrypoints/background.ts`: browser event registration and service wiring.
- `components/Finder.tsx`: shared Solid finder interface.
- `entrypoints/content/`: centered page overlay; `entrypoints/finder/`: fallback window.
- `entrypoints/options/`: shortcut configuration and usage instructions.

## MVP boundaries

Browser-owned pages (such as `about:` and `chrome:` pages), extension stores, and pages without an attached content script cannot host the overlay. The command opens the same finder in a separate centered window there. History is bounded as described above, and source data refreshes when reopening the finder. A tab closed while the finder is open produces an error rather than opening an unrelated result. Bookmarklets and other executable URL schemes are not activated.

## Manual smoke checks

1. Open tabs in two windows, switch between them, and verify empty-query MRU order and double-tap switching.
2. Bookmark a URL that is also open and in history; give the bookmark a distinct title. Search that title and verify the result appears once with the tab label and activates the existing tab.
3. Enter a non-contiguous query, inspect highlights, navigate with both key sets, and activate with Enter and a mouse click.
4. Use Ctrl+Enter and verify the browser’s configured default engine opens in a normal window.
5. Close with Esc and verify the page’s previous input regains focus.
6. Open from a restricted browser page and verify the fallback window, including double-tap switching.
7. In Firefox, test a custom theme and change/reset the launch shortcut in options.

Automated tests cover fuzzy alignment and ranking, alternate-title matching and activation, highlight segmentation, message contracts, MRU initialization and persistence, key handling, source failures, theme conversion, cross-window activation, browser search APIs, and double-tap fallback behavior. Browser UI checks still require a live browser.
