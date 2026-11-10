import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing";
import {
	dispatch,
	type Handlers,
	isRequest,
	request,
	type Snapshot,
} from "./messages";
import type { Candidate } from "./types";

const sender = { id: fakeBrowser.runtime.id };

const handlers: Handlers = {
	snapshot: async () => ({ candidates: [], theme: {}, warnings: [] }),
	activate: async () => {
		throw new Error("Tab closed");
	},
	searchWeb: async () => undefined,
	overlayReady: async () => undefined,
};

describe("request", () => {
	it("infers the reply type from the request type", async () => {
		const snapshot: Snapshot = { candidates: [], theme: {}, warnings: [] };
		vi.spyOn(fakeBrowser.runtime, "sendMessage").mockResolvedValueOnce({
			ok: true,
			value: snapshot,
		});
		const reply = request({ type: "snapshot" });
		expectTypeOf(reply).toEqualTypeOf<Promise<Snapshot>>();
		expect(await reply).toEqual(snapshot);
	});

	it("rethrows the background's error", async () => {
		const reply = await dispatch(
			{ type: "activate", target: { kind: "tab", tabId: 2 } },
			sender,
			handlers,
		);
		expect(reply).toEqual({ ok: false, error: "Tab closed" });
		vi.spyOn(fakeBrowser.runtime, "sendMessage").mockResolvedValueOnce(reply);
		await expect(
			request({ type: "activate", target: { kind: "tab", tabId: 2 } }),
		).rejects.toThrow("Tab closed");
	});

	it("explains a missing reply", async () => {
		vi.spyOn(fakeBrowser.runtime, "sendMessage").mockResolvedValueOnce(
			undefined,
		);
		await expect(request({ type: "snapshot" })).rejects.toThrow(
			/could not reach/,
		);
	});
});

describe("isRequest", () => {
	it("rejects malformed messages", () => {
		for (const message of [
			null,
			"snapshot",
			{},
			{ type: "unknown" },
			{ type: "searchWeb", query: 12 },
			{ type: "activate" },
			{ type: "activate", target: { kind: "tab" } },
			{ type: "activate", target: { kind: "tab", tabId: -1 } },
			{ type: "activate", target: { kind: "tab", tabId: 1.5 } },
			{ type: "activate", target: { kind: "url", url: 12 } },
			{ type: "activate", target: { kind: "window", id: 1 } },
		]) {
			expect(isRequest(message)).toBe(false);
		}
	});

	it("accepts well-formed messages", () => {
		for (const message of [
			{ type: "snapshot" },
			{ type: "overlayReady" },
			{ type: "searchWeb", query: "cats" },
			{ type: "activate", target: { kind: "tab", tabId: 0 } },
			{ type: "activate", target: { kind: "url", url: "https://a.test" } },
		]) {
			expect(isRequest(message)).toBe(true);
		}
	});
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
