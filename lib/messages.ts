import { browser } from "wxt/browser";
import type { ActivationTarget, Candidate } from "./types";
export interface Snapshot {
	candidates: Candidate[];
	theme: Record<string, string>;
	warnings: string[];
}
export interface RequestMap {
	snapshot: { type: "snapshot" };
	activate: { type: "activate"; target: ActivationTarget };
	search: { type: "search"; query: string };
}
export interface ResponseMap {
	snapshot: Snapshot;
	activate: undefined;
	search: undefined;
}
export type Request = RequestMap[keyof RequestMap];
export type Handlers = {
	[K in keyof RequestMap]: (message: RequestMap[K]) => Promise<ResponseMap[K]>;
};
export type Reply<T> = { ok: true; value: T } | { ok: false; error: string };
export async function request<R extends Request>(
	message: R,
): Promise<ResponseMap[R["type"]]> {
	const reply: Reply<ResponseMap[R["type"]]> =
		await browser.runtime.sendMessage(message);
	if (!reply?.ok)
		throw new Error(
			reply?.error ||
				"BrowserScope could not reach the browser. Try reopening it.",
		);
	return reply.value;
}
export function isRequest(message: unknown): message is Request {
	if (!message || typeof message !== "object" || !("type" in message))
		return false;
	if (message.type === "snapshot") return true;
	if (message.type === "search")
		return "query" in message && typeof message.query === "string";
	if (message.type !== "activate" || !("target" in message)) return false;
	const target = message.target;
	if (!target || typeof target !== "object" || !("kind" in target))
		return false;
	return target.kind === "tab"
		? "tabId" in target &&
				typeof target.tabId === "number" &&
				Number.isInteger(target.tabId) &&
				target.tabId >= 0
		: target.kind === "url" &&
				"url" in target &&
				typeof target.url === "string";
}
export async function dispatch(
	message: Request,
	handlers: Handlers,
): Promise<Reply<Snapshot | undefined>> {
	try {
		switch (message.type) {
			case "snapshot":
				return { ok: true, value: await handlers.snapshot(message) };
			case "activate":
				return { ok: true, value: await handlers.activate(message) };
			case "search":
				return { ok: true, value: await handlers.search(message) };
		}
	} catch (error) {
		return {
			ok: false,
			error:
				error instanceof Error
					? error.message
					: "The browser could not complete this action.",
		};
	}
}
