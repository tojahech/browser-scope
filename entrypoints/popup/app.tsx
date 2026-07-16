import {
	createEffect,
	createMemo,
	createSignal,
	For,
	on,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { browser } from "wxt/browser";
import {
	activateResult,
	openWebSearch,
	switchToPreviousTab,
} from "../../lib/actions";
import { CONFIG } from "../../lib/config";
import { segmentByIndices } from "../../lib/highlight";
import {
	KEYBINDINGS,
	LAUNCH_SHORTCUT_DEFAULT,
	matchesBinding,
	matchesShortcut,
	type ParsedShortcut,
	parseCommandShortcut,
} from "../../lib/keybindings";
import {
	dedupeCandidates,
	type SearchResult,
	searchCandidates,
} from "../../lib/search";
import { loadCandidates } from "../../lib/sources";
import { applyBrowserTheme } from "../../lib/theme";
import type { Candidate, SourceType } from "../../lib/types";
import "./app.css";

const TYPE_BADGE: Record<SourceType, string> = {
	tab: "T",
	bookmark: "B",
	history: "H",
};

const isMac = navigator.platform.toLowerCase().includes("mac");

function Highlighted(props: { text: string; indices: number[] }) {
	const segments = createMemo(() =>
		segmentByIndices(props.text, props.indices),
	);
	return (
		<For each={segments()}>
			{(segment) =>
				segment.highlighted ? <mark>{segment.text}</mark> : segment.text
			}
		</For>
	);
}

function App() {
	const openedAt = performance.now();
	const [query, setQuery] = createSignal("");
	const [candidates, setCandidates] = createSignal<Candidate[]>([]);
	const [selectedRaw, setSelectedRaw] = createSignal(0);

	let launchShortcut: ParsedShortcut | null = parseCommandShortcut(
		LAUNCH_SHORTCUT_DEFAULT,
		isMac,
	);
	let inputRef: HTMLInputElement | undefined;
	let listRef: HTMLDivElement | undefined;

	const results = createMemo(() => searchCandidates(query(), candidates()));
	const selected = () =>
		Math.min(selectedRaw(), Math.max(0, results().length - 1));

	createEffect(on(query, () => setSelectedRaw(0)));

	// Keep the selected row in view as the selection moves.
	createEffect(() => {
		const row = listRef?.children[selected()];
		if (row instanceof HTMLElement) row.scrollIntoView({ block: "nearest" });
	});

	onMount(() => {
		// Firefox assigns focus to the popup document itself shortly after
		// opening, which can steal focus from the input if we only focus once
		// on mount. Retry over the first few frames until focus sticks.
		const focusInput = () => {
			if (document.activeElement !== inputRef) inputRef?.focus();
		};
		focusInput();
		requestAnimationFrame(focusInput);
		const focusTimer = setInterval(focusInput, 50);
		setTimeout(() => clearInterval(focusTimer), 500);
		void applyBrowserTheme();
		void loadCandidates().then((loaded) =>
			setCandidates(dedupeCandidates(loaded)),
		);
		// Resolve the user's actual launch shortcut for double-tap detection.
		void browser.commands
			.getAll()
			.then((commands) => {
				const launch = commands.find((c) => c.name?.startsWith("_execute_"));
				if (launch?.shortcut) {
					launchShortcut =
						parseCommandShortcut(launch.shortcut, isMac) ?? launchShortcut;
				}
			})
			.catch(() => {});
	});

	function move(delta: number) {
		const count = results().length;
		if (count === 0) return;
		setSelectedRaw(Math.max(0, Math.min(count - 1, selected() + delta)));
	}

	async function confirm(result: SearchResult | undefined) {
		if (result === undefined) return;
		await activateResult(result);
		window.close();
	}

	function onKeyDown(e: KeyboardEvent) {
		// Second press of the launch shortcut in quick succession: switch to
		// the previously active tab (Alt-Tab style) and close.
		if (
			launchShortcut !== null &&
			matchesShortcut(e, launchShortcut) &&
			!e.repeat &&
			performance.now() - openedAt <= CONFIG.DOUBLE_TAP_MS
		) {
			e.preventDefault();
			void switchToPreviousTab().then(() => window.close());
			return;
		}
		if (matchesBinding(e, KEYBINDINGS.moveDown)) {
			e.preventDefault();
			move(1);
		} else if (matchesBinding(e, KEYBINDINGS.moveUp)) {
			e.preventDefault();
			move(-1);
		} else if (matchesBinding(e, KEYBINDINGS.webSearch)) {
			e.preventDefault();
			const text = query().trim();
			if (text !== "") void openWebSearch(text).then(() => window.close());
		} else if (matchesBinding(e, KEYBINDINGS.confirm)) {
			e.preventDefault();
			void confirm(results()[selected()]);
		} else if (matchesBinding(e, KEYBINDINGS.close)) {
			e.preventDefault();
			window.close();
		}
	}

	window.addEventListener("keydown", onKeyDown);
	onCleanup(() => window.removeEventListener("keydown", onKeyDown));

	return (
		<div class="app" style={{ width: `${CONFIG.POPUP_WIDTH}px` }}>
			<input
				ref={inputRef}
				class="query"
				type="text"
				autofocus
				placeholder="Search tabs, bookmarks, history…"
				spellcheck={false}
				autocomplete="off"
				value={query()}
				onInput={(e) => setQuery(e.currentTarget.value)}
			/>
			<Show
				when={results().length > 0}
				fallback={
					<div class="empty">
						{query().trim() === "" ? "No open tabs" : "No matches"}
					</div>
				}
			>
				<div
					ref={listRef}
					class="results"
					style={{
						"--row-height": `${CONFIG.RESULT_ROW_HEIGHT}px`,
						"max-height": `${CONFIG.RESULT_ROW_HEIGHT * CONFIG.MAX_VISIBLE_RESULTS}px`,
					}}
				>
					<For each={results()}>
						{(result, index) => (
							<button
								type="button"
								classList={{ row: true, selected: index() === selected() }}
								onClick={() => void confirm(result)}
							>
								<span class={`badge ${result.type}`}>
									{TYPE_BADGE[result.type]}
								</span>
								<span class="title" title={result.url}>
									<Highlighted
										text={result.title}
										indices={result.titleIndices}
									/>
								</span>
							</button>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
}

export default App;
