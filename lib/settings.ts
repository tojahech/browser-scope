import { DEFAULT_DISPLAY_MODE, type DisplayMode } from "./config";

export const displayMode = storage.defineItem<DisplayMode>(
	"local:displayMode",
	{ fallback: DEFAULT_DISPLAY_MODE },
);
