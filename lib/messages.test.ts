import { expect, expectTypeOf, it, vi } from "vitest";
import {
	dispatch,
	type Handlers,
	isRequest,
	request,
	type Snapshot,
} from "./messages";
import type { Candidate } from "./types";

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }));
vi.mock("wxt/browser", () => ({ browser: { runtime: { sendMessage } } }));
it("infers replies from request types", async () => {
	const snapshot: Snapshot = { candidates: [], theme: {}, warnings: [] };
	sendMessage.mockResolvedValueOnce({ ok: true, value: snapshot });
	const result = request({ type: "snapshot" });
	expectTypeOf(result).toEqualTypeOf<Promise<Snapshot>>();
	expect(await result).toEqual(snapshot);
	sendMessage.mockResolvedValueOnce({ ok: true, value: undefined });
	const activation = request({
		type: "activate",
		target: { kind: "tab", tabId: 2 },
	});
	expectTypeOf(activation).toEqualTypeOf<Promise<undefined>>();
	await activation;
});
it("requires tab identity at compile time", () => {
	// @ts-expect-error A tab candidate must carry a tab ID and window ID.
	const invalid: Candidate = {
		source: "tab",
		id: "1",
		title: "Tab",
		url: "https://example.test",
		mruRank: 0,
	};
	expect(invalid.source).toBe("tab");
});
it("validates action payloads at the runtime boundary", () => {
	for (const message of [
		null,
		{},
		{ type: "search", query: 12 },
		{ type: "activate", target: { kind: "tab" } },
		{ type: "activate", target: { kind: "tab", tabId: -1 } },
		{ type: "activate", target: { kind: "tab", tabId: 1.5 } },
		{ type: "activate", target: { kind: "url", url: 12 } },
	])
		expect(isRequest(message)).toBe(false);
	expect(
		isRequest({ type: "activate", target: { kind: "tab", tabId: 0 } }),
	).toBe(true);
	expect(
		isRequest({
			type: "activate",
			target: { kind: "url", url: "https://example.test" },
		}),
	).toBe(true);
});
it("propagates action errors through the reply envelope", async () => {
	const handlers: Handlers = {
		snapshot: async () => ({ candidates: [], theme: {}, warnings: [] }),
		activate: async () => {
			throw new Error("Tab closed");
		},
		search: async () => undefined,
	};
	const reply = await dispatch(
		{ type: "activate", target: { kind: "tab", tabId: 2 } },
		handlers,
	);
	expect(reply).toEqual({ ok: false, error: "Tab closed" });
	sendMessage.mockResolvedValueOnce(reply);
	await expect(
		request({ type: "activate", target: { kind: "tab", tabId: 2 } }),
	).rejects.toThrow("Tab closed");
});
