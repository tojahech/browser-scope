# BrowserScope

A keyboard-driven fuzzy finder for the browser, inspired by
[telescope.nvim](https://github.com/nvim-telescope/telescope.nvim). Press
`Ctrl+Space`, type, hit `Enter` — instantly jump between tabs, bookmarks, and
history. See [SPEC.md](SPEC.md) for the full specification.

## Usage

| Key                    | Action                                                |
| ---------------------- | ----------------------------------------------------- |
| `Ctrl+Space`           | Open the popup (configurable in shortcut settings)    |
| `Ctrl+Space` twice     | Switch straight to the previously active tab          |
| `Ctrl+j` / `↓`         | Move selection down                                   |
| `Ctrl+k` / `↑`         | Move selection up                                     |
| `Enter`                | Switch to tab / open bookmark or history in a new tab |
| `Ctrl+Enter`           | Web-search the raw query in a new tab                 |
| `Esc`                  | Close the popup                                       |

With an empty query the list shows open tabs in most-recently-used order, so
`Ctrl+Space Enter` also flips to the previous tab.

## Development

Firefox is the primary target; Chrome/Chromium is secondary.

```sh
mise install        # install node + pnpm
mise run install    # pnpm install
mise run dev        # run in Firefox with live reload (dev:chrome for Chrome)
mise run check      # type-check + lint + unit tests
mise run build      # production build (build:chrome for Chrome)
```

### Layout

- `lib/config.ts` — all global constants
- `lib/keybindings.ts` — all hotkeys
- `lib/fuzzy.ts` — fzf-style fuzzy matcher (pure, unit-tested)
- `lib/search.ts` — dedupe + ranking pipeline (pure, unit-tested)
- `lib/sources.ts` — tab/bookmark/history loading
- `entrypoints/popup/` — the finder UI (Solid)
- `entrypoints/options/` — options page (launch-shortcut rebinding)

## Tech

Written in Typescript.

Uses `mise` for tooling and system dependencies.
Uses `pnpm` for typescript package management.
Uses `wxt` as a browser plugin framework.
Uses `biome` for formatting and linting.
Uses `solid` for reactivity.
Uses `vitest` for unit tests.
