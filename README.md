# Browser Scope

Browser scope is a Firefox plugin which aims to bring a neovim / Telescope style UX to the browser.

## Tech

Written in Typescript.

Uses `mise` for tooling and system dependencies.
Uses `pnpm` for typescript package management.
Uses `wxt` as a browser plugin framework.
Uses `biome` for formatting and linting.
Uses `solid` for reactivity and frontend routing.

## Development

```sh
mise install        # node + pnpm
mise run install    # pnpm install
mise run dev        # launch Firefox with the extension loaded (hot reload)
mise run dev:chrome
mise run check      # type check, lint, test
mise run build      # build Firefox + Chrome into .output/
```

## Layout

- `lib/config.ts` — all global constants (source weights, double-tap window, sizes, default shortcut)
- `lib/keybindings.ts` — in-finder keybindings
- `lib/fuzzy.ts` — fzf-style fuzzy matcher (scores normalised to 0..1, match positions for highlighting)
- `lib/search.ts` — dedupe + ranking (match quality × source weight)
- `entrypoints/background.ts` — launch command, double-tap quick switch, candidate loading, tab activation
- `entrypoints/overlay.content/` — in-page overlay (shadow DOM)
- `entrypoints/popup/` — toolbar popup
- `entrypoints/options/` — display mode + launch shortcut settings
- `components/Finder.tsx` — the finder UI shared by overlay and popup
