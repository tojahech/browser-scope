/**
 * Maps the Firefox theme onto the finder's CSS custom properties. Chrome has no theme API, so it
 * gets an empty map and the default palette in finder.css.
 */

import { firefox, type ThemeColor } from "../browser-compat";

/** CSS var -> Firefox theme colour keys, in order of preference. */
const MAPPING: Record<string, string[]> = {
	"--bs-bg": ["popup", "toolbar", "frame"],
	"--bs-fg": ["popup_text", "toolbar_text", "tab_background_text"],
	"--bs-border": ["popup_border", "toolbar_field_border"],
	"--bs-input-bg": ["toolbar_field", "popup"],
	"--bs-input-fg": ["toolbar_field_text", "popup_text"],
	"--bs-input-border": [
		"toolbar_field_border_focus",
		"toolbar_field_border",
		"popup_border",
	],
	"--bs-selected-bg": ["popup_highlight", "toolbar_field_highlight"],
	"--bs-selected-fg": ["popup_highlight_text", "toolbar_field_highlight_text"],
	"--bs-accent": ["tab_line", "toolbar_field_border_focus", "icons_attention"],
};

/** A theme colour as CSS, or undefined if it's missing or malformed. */
function toCss(color: ThemeColor): string | undefined {
	if (typeof color === "string") return color || undefined;
	if (Array.isArray(color) && (color.length === 3 || color.length === 4)) {
		const [r, g, b, alpha] = color;
		return `rgb(${r} ${g} ${b}${alpha === undefined ? "" : ` / ${alpha}`})`;
	}
	return undefined;
}

export function themeVariables(
	colors: Record<string, ThemeColor> | null | undefined,
): Record<string, string> {
	const vars: Record<string, string> = {};
	if (!colors) return vars;
	for (const [cssVar, keys] of Object.entries(MAPPING)) {
		for (const key of keys) {
			const value = toCss(colors[key]);
			if (value) {
				vars[cssVar] = value;
				break;
			}
		}
	}
	return vars;
}

export async function loadTheme(
	windowId?: number,
): Promise<Record<string, string>> {
	if (!import.meta.env.FIREFOX) return {};
	try {
		return themeVariables((await firefox.theme.getCurrent(windowId)).colors);
	} catch {
		return {};
	}
}
