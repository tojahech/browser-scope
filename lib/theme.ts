import { firefox } from "./firefox";
export function themeVariables(
	colors: Record<string, string | number[] | null> = {},
): Record<string, string> {
	const theme: Record<string, string> = {};
	const mapping = {
		"--surface": colors.popup,
		"--text": colors.popup_text,
		"--border": colors.popup_border,
		"--selected": colors.popup_highlight,
		"--selected-text": colors.popup_highlight_text,
	};
	for (const [key, value] of Object.entries(mapping)) {
		if (typeof value === "string" && value) theme[key] = value;
		else if (
			Array.isArray(value) &&
			(value.length === 3 || value.length === 4)
		) {
			const [r, g, b, alpha] = value;
			theme[key] =
				`rgb(${r} ${g} ${b}${alpha === undefined ? "" : ` / ${alpha}`})`;
		}
	}
	return theme;
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
