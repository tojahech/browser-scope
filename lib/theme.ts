/**
 * Derives the popup palette from the active browser theme.
 *
 * Firefox exposes theme colours via `theme.getCurrent()`; when present they
 * override the CSS custom properties. Chrome has no theme API, so the
 * `light-dark()` fallback palette defined in style.css applies.
 */
import { browser } from "wxt/browser";

type ThemeColor = string | number[] | null | undefined;

interface ThemeApi {
	getCurrent(): Promise<{ colors?: Record<string, ThemeColor> | null }>;
}

function cssColor(color: ThemeColor): string | null {
	if (typeof color === "string" && color !== "") return color;
	if (Array.isArray(color) && (color.length === 3 || color.length === 4)) {
		const [r, g, b, a] = color;
		return a === undefined
			? `rgb(${r} ${g} ${b})`
			: `rgb(${r} ${g} ${b} / ${a})`;
	}
	return null;
}

export async function applyBrowserTheme(): Promise<void> {
	const theme = (browser as unknown as { theme?: ThemeApi }).theme;
	if (theme === undefined) return;

	let colors: Record<string, ThemeColor> | null | undefined;
	try {
		({ colors } = await theme.getCurrent());
	} catch {
		return;
	}
	if (!colors) return;

	const vars: Record<string, ThemeColor[]> = {
		"--bs-bg": [colors.popup, colors.toolbar, colors.frame],
		"--bs-text": [
			colors.popup_text,
			colors.toolbar_text,
			colors.tab_background_text,
		],
		"--bs-border": [colors.popup_border, colors.toolbar_field_border],
		"--bs-input-bg": [colors.toolbar_field],
		"--bs-input-text": [colors.toolbar_field_text],
		"--bs-selection-bg": [colors.popup_highlight],
		"--bs-selection-text": [colors.popup_highlight_text],
		"--bs-accent": [colors.tab_line, colors.icons_attention],
	};
	const root = document.documentElement;
	for (const [name, chain] of Object.entries(vars)) {
		for (const color of chain) {
			const value = cssColor(color);
			if (value !== null) {
				root.style.setProperty(name, value);
				break;
			}
		}
	}
}
