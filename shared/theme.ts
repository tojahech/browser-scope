interface ThemeColors {
	accentcolor?: string;
	frame?: string;
	ntp_background?: string;
	tab_selected?: string;
	toolbar?: string;
	toolbar_field?: string;
	toolbar_field_border?: string;
	toolbar_field_focus?: string;
	toolbar_field_text?: string;
	toolbar_text?: string;
}

interface BrowserTheme {
	colors?: ThemeColors;
}

type ThemeApi = { getCurrent: () => Promise<BrowserTheme> };

function setVariable(name: string, value: string | undefined) {
	if (value) document.documentElement.style.setProperty(name, value);
}

export async function applyBrowserTheme() {
	const theme = (browser as unknown as { theme?: ThemeApi }).theme;
	if (!theme) return;

	try {
		const colors = (await theme.getCurrent()).colors;
		if (!colors) return;
		setVariable(
			"--scope-background",
			colors.toolbar ?? colors.ntp_background ?? colors.frame,
		);
		setVariable("--scope-foreground", colors.toolbar_text);
		setVariable("--scope-input-background", colors.toolbar_field);
		setVariable(
			"--scope-input-foreground",
			colors.toolbar_field_text ?? colors.toolbar_text,
		);
		setVariable("--scope-border", colors.toolbar_field_border);
		setVariable(
			"--scope-accent",
			colors.toolbar_field_focus ?? colors.tab_selected ?? colors.accentcolor,
		);
	} catch {
		// Chromium does not consistently expose theme.getCurrent(); its CSS fallback is intentional.
	}
}
