/** CSS custom properties applied to the finder UI. Unset vars fall back to the default palette in CSS. */
export type ThemeVars = Record<string, string>;

type ThemeColor = string | [number, number, number] | null | undefined;

/** Subset of Firefox's `theme.ThemeType["colors"]` that we read. */
export type FirefoxThemeColors = Partial<Record<string, ThemeColor>>;

/** CSS var -> Firefox theme color keys, in order of preference. */
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

function toCss(color: ThemeColor): string | undefined {
	if (!color) return undefined;
	if (Array.isArray(color)) return `rgb(${color.join(", ")})`;
	return color;
}

export function themeVarsFromFirefox(
	colors: FirefoxThemeColors | null | undefined,
): ThemeVars {
	const vars: ThemeVars = {};
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

export function applyTheme(el: HTMLElement, vars: ThemeVars) {
	for (const [name, value] of Object.entries(vars)) {
		el.style.setProperty(name, value);
	}
}
