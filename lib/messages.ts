/**
 * The message contract between the finder UI and the background. Requests are validated on arrival
 * and every reply travels in an `{ ok, error }` envelope, so failures reach the UI as messages.
 */

import { type Browser, browser } from "wxt/browser";
import type { ActivationTarget, Candidate } from "./types";

export interface Snapshot {
	candidates: Candidate[];
	/** CSS custom properties from the browser theme; empty means use the default palette. */
	theme: Record<string, string>;
	/** Sources that could not be loaded, as user-facing sentences. */
	warnings: string[];
}

/** Messages the UI sends to the background. */
export interface RequestMap {
	snapshot: { type: "snapshot" };
	activate: { type: "activate"; target: ActivationTarget };
	searchWeb: { type: "searchWeb"; query: string };
	overlayReady: { type: "overlayReady" };
}

export interface ResponseMap {
	snapshot: Snapshot;
	activate: undefined;
	searchWeb: undefined;
	overlayReady: undefined;
}

export type Request = RequestMap[keyof RequestMap];

export type Handlers = {
	[K in keyof RequestMap]: (
		message: RequestMap[K],
		sender: Browser.runtime.MessageSender,
	) => Promise<ResponseMap[K]>;
};

export type Reply<T> = { ok: true; value: T } | { ok: false; error: string };

/** Messages the background sends to the UI (overlay content script or popup). */
export type UiMessage = { type: "toggleOverlay" } | { type: "closeUi" };

/** Send a request to the background and unwrap its reply, throwing its error message on failure. */
export async function request<R extends Request>(
	message: R,
): Promise<ResponseMap[R["type"]]> {
	const reply: Reply<ResponseMap[R["type"]]> | undefined =
		await browser.runtime.sendMessage(message);
	if (!reply?.ok) {
		throw new Error(
			reply?.error ||
				"BrowserScope could not reach the browser. Try reopening it.",
		);
	}
	return reply.value;
}

/** Runtime check for anything arriving at the background; messages are untrusted input. */
export function isRequest(message: unknown): message is Request {
	if (!message || typeof message !== "object" || !("type" in message)) {
		return false;
	}
	switch (message.type) {
		case "snapshot":
		case "overlayReady":
			return true;
		case "searchWeb":
			return "query" in message && typeof message.query === "string";
		case "activate":
			return "target" in message && isActivationTarget(message.target);
		default:
			return false;
	}
}

function isActivationTarget(target: unknown): target is ActivationTarget {
	if (!target || typeof target !== "object" || !("kind" in target)) {
		return false;
	}
	if (target.kind === "tab") {
		return (
			"tabId" in target &&
			typeof target.tabId === "number" &&
			Number.isInteger(target.tabId) &&
			target.tabId >= 0
		);
	}
	return (
		target.kind === "url" && "url" in target && typeof target.url === "string"
	);
}

/** Run the handler for a validated request and wrap the outcome in a reply envelope. */
export async function dispatch(
	message: Request,
	sender: Browser.runtime.MessageSender,
	handlers: Handlers,
): Promise<Reply<unknown>> {
	// The union of handler signatures can't be called directly; `isRequest` has already matched
	// the message to its type, so this cast is safe.
	const handler = handlers[message.type] as (
		message: Request,
		sender: Browser.runtime.MessageSender,
	) => Promise<unknown>;
	try {
		return { ok: true, value: await handler(message, sender) };
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
