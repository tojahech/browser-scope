import { beforeEach, expect, it, vi } from "vitest";
import { createMruStore } from "./mru";

const { get, set, query } = vi.hoisted(() => ({
	get: vi.fn(),
	set: vi.fn(),
	query: vi.fn(),
}));
vi.mock("wxt/browser", () => ({
	browser: { storage: { local: { get, set } }, tabs: { query } },
}));
beforeEach(() => {
	vi.resetAllMocks();
	get.mockResolvedValue({ mru: [1, 2] });
	set.mockResolvedValue(undefined);
	query.mockResolvedValue([
		{ id: 1, lastAccessed: 1 },
		{ id: 2, lastAccessed: 2 },
	]);
});
it("preserves activations and removals queued during initialization", async () => {
	let resolve!: (value: { mru: number[] }) => void;
	get.mockReturnValueOnce(
		new Promise((done) => {
			resolve = done;
		}),
	);
	const store = createMruStore();
	const activation = store.touch(2);
	const removal = store.remove(1);
	resolve({ mru: [1, 2] });
	await Promise.all([activation, removal]);
	expect(await store.read()).toEqual([2]);
	expect(set.mock.calls.map(([value]) => value.mru)).toEqual([[2, 1], [2]]);
});
it("reconciles persisted IDs and returns independent snapshots", async () => {
	get.mockResolvedValueOnce({ mru: [1, 1, 999, "2"] });
	const store = createMruStore();
	const before = await store.read();
	await store.touch(2);
	expect(before).toEqual([1, 2]);
	expect(await store.read()).toEqual([2, 1]);
});
it("falls back to browser recency if storage cannot be read", async () => {
	get.mockRejectedValueOnce(new Error("storage unavailable"));
	expect(await createMruStore().read()).toEqual([2, 1]);
});
it("retains in-memory updates and continues after a failed persistence write", async () => {
	const log = vi.spyOn(console, "error").mockImplementation(() => {});
	try {
		set.mockRejectedValueOnce(new Error("storage unavailable"));
		const store = createMruStore();
		await store.touch(2);
		expect(await store.read()).toEqual([2, 1]);
		await store.remove(1);
		expect(await store.read()).toEqual([2]);
	} finally {
		log.mockRestore();
	}
});
it("restores persisted ordering after the store is recreated", async () => {
	const first = createMruStore();
	await first.touch(2);
	get.mockResolvedValueOnce(set.mock.calls.at(-1)?.[0]);
	expect(await createMruStore().read()).toEqual([2, 1]);
});
