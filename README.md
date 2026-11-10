# Browser Scope

Browser scope is a Firefox plugin which aims to bring a neovim / Telescope style UX to the browser.
See [SPEC.md](SPEC.md) for behaviour.

## Tech

Written in Typescript.

Uses `mise` for tooling and system dependencies.
Uses `pnpm` for typescript package management.
Uses `wxt` as a browser plugin framework.
Uses `biome` for formatting and linting.
Uses `solid` for reactivity.
Uses `vitest` with WXT's fake browser for tests.

## Tasks

```sh
mise run install      # install dependencies
mise run dev          # Firefox with live reload (dev:chrome for Chrome)
mise run check        # type-check, lint and test
mise run build        # build Firefox and Chrome
```

## Layout

```
lib/
  config.ts             all tunable constants
  types.ts              Candidate, ActivationTarget, UrlGroup, Result
  messages.ts           UI <-> background contract: request(), isRequest(), dispatch()
  keybindings.ts        finder keys, plus shortcut capture for the options page
  highlight.ts          match positions -> highlighted segments
  settings.ts           display mode (overlay or popup)
  browser-compat.ts     types for Firefox-only APIs
  search/
    fuzzy.ts            fzf v2 style matcher, scores 0..1
    rank.ts             URL grouping, multi-term matching, source weighting
  background/
    sources.ts          tabs, bookmarks, history; cached and kept current from events
    mru.ts              persisted most-recently-used tab order
    launcher.ts         launch shortcut, double tap, overlay/popup choice
    actions.ts          open a result, web search
    theme.ts            Firefox theme -> CSS variables
components/Finder.tsx   the finder UI, shared by overlay and popup
entrypoints/
  background.ts         wiring only
  overlay.content/      in-page overlay (shadow root, inert page)
  popup/                toolbar popup
  options/              display mode, shortcut, key reference
```

Rules that keep this shape:

- Only `lib/background/*` and `entrypoints/background.ts` call browser data APIs (tabs, bookmarks,
  history, search, theme). The UI reaches them only through `request()`.
- `lib/search/*`, `lib/highlight.ts`, `lib/keybindings.ts` and `lib/types.ts` don't import from
  `wxt/browser`.
- Background modules are factories (`createSources`, `createMruStore`, `createLauncher`) so tests
  can create fresh instances against the fake browser.
- Tests sit next to their module as `*.test.ts`. The background wiring test lives in
  `lib/background/` because WXT treats every file in `entrypoints/` as an entrypoint.
