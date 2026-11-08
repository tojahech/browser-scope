import { browser } from "wxt/browser";
import type { Candidate } from "./search";
export type Request =
	| { type: "snapshot" }
	| { type: "activate"; result: Candidate }
	| { type: "search"; query: string };
export interface Snapshot {
	candidates: Candidate[];
	theme: Record<string, string>;
	warnings: string[];
}
export type Reply<T> = { ok: true; value: T } | { ok: false; error: string };
export async function request<T = undefined>(message: Request): Promise<T> {
	const reply: Reply<T> = await browser.runtime.sendMessage(message);
	if (!reply?.ok)
		throw new Error(
			reply?.error ||
				"BrowserScope could not reach the browser. Try reopening it.",
		);
	return reply.value;
}
