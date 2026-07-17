import {
	createEffect,
	createSignal,
	For,
	on,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { CONFIG } from "../../shared/config";
import {
	isMoveDown,
	isMoveUp,
	POPUP_KEYBINDINGS,
} from "../../shared/keybindings";
import {
	activateResult,
	findResults,
	searchWithDefaultEngine,
} from "../../shared/results";
import type { SearchResult } from "../../shared/search";
import { applyBrowserTheme } from "../../shared/theme";
import "./app.css";

const SOURCE_LABEL = {
	bookmark: "B",
	history: "H",
	tab: "T",
} as const;

function HighlightedTitle(props: { positions: number[]; title: string }) {
	const matchedPositions = new Set(props.positions);
	return (
		<For each={[...props.title]}>
			{(character, index) =>
				matchedPositions.has(index()) ? <mark>{character}</mark> : character
			}
		</For>
	);
}

function App() {
	const [query, setQuery] = createSignal("");
	const [results, setResults] = createSignal<SearchResult[]>([]);
	const [selectedIndex, setSelectedIndex] = createSignal(0);
	const [isLoading, setIsLoading] = createSignal(true);
	let requestId = 0;
	const resultRows: HTMLButtonElement[] = [];

	const refreshResults = async (value: string) => {
		const currentRequest = ++requestId;
		setIsLoading(true);
		try {
			const nextResults = await findResults(value);
			if (currentRequest !== requestId) return;
			setResults(nextResults);
		} catch {
			if (currentRequest !== requestId) return;
			setResults([]);
		} finally {
			if (currentRequest === requestId) setIsLoading(false);
		}
	};

	const moveSelection = (amount: number) => {
		const count = results().length;
		if (count === 0) return;
		setSelectedIndex((index) => (index + amount + count) % count);
	};

	const confirmSelection = async () => {
		const result = results()[selectedIndex()];
		if (result) await activateResult(result);
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === POPUP_KEYBINDINGS.CLOSE) {
			event.preventDefault();
			window.close();
			return;
		}
		if (isMoveDown(event)) {
			event.preventDefault();
			moveSelection(1);
			return;
		}
		if (isMoveUp(event)) {
			event.preventDefault();
			moveSelection(-1);
			return;
		}
		if (event.key !== POPUP_KEYBINDINGS.CONFIRM) return;
		event.preventDefault();
		if (event.ctrlKey) {
			void searchWithDefaultEngine(query());
			return;
		}
		void confirmSelection();
	};

	createEffect(on(results, () => setSelectedIndex(0)));
	createEffect(() => {
		const row = resultRows[selectedIndex()];
		row?.scrollIntoView({ block: "nearest" });
	});

	onMount(() => {
		void applyBrowserTheme();
		void browser.runtime.sendMessage({ type: "popup-opened" });
		void refreshResults("");
		const closeListener = (message: { type?: string }) => {
			if (message.type === "close-popup") window.close();
		};
		browser.runtime.onMessage.addListener(closeListener);
		onCleanup(() => {
			browser.runtime.onMessage.removeListener(closeListener);
			void browser.runtime
				.sendMessage({ type: "popup-closed" })
				.catch(() => undefined);
		});
	});

	return (
		<main class="scope" onKeyDown={handleKeyDown}>
			<div class="search-bar">
				<input
					aria-controls="scope-results"
					aria-label="Search tabs, bookmarks, and history"
					autofocus
					placeholder="Search tabs, bookmarks, and history"
					type="text"
					value={query()}
					onInput={(event) => {
						const value = event.currentTarget.value;
						setQuery(value);
						void refreshResults(value);
					}}
				/>
			</div>

			<div
				aria-busy={isLoading()}
				aria-label="BrowserScope results"
				class="results"
				id="scope-results"
				role="listbox"
				style={{ "--visible-results": CONFIG.MAX_VISIBLE_RESULTS.toString() }}
			>
				<Show when={!isLoading() && results().length === 0}>
					<p class="empty">
						{query().trim() ? `No results for “${query()}”` : "No open tabs"}
					</p>
				</Show>
				<For each={results()}>
					{(result, index) => (
						<button
							aria-selected={selectedIndex() === index()}
							class="result"
							classList={{ selected: selectedIndex() === index() }}
							ref={(element) => {
								resultRows[index()] = element;
							}}
							role="option"
							type="button"
							onClick={() => void activateResult(result)}
							onMouseMove={() => setSelectedIndex(index())}
						>
							<span
								aria-label={result.source}
								class={`source ${result.source}`}
								role="img"
								title={result.source}
							>
								{SOURCE_LABEL[result.source]}
							</span>
							<span class="title">
								<HighlightedTitle
									positions={result.matchPositions}
									title={result.title}
								/>
							</span>
						</button>
					)}
				</For>
			</div>
		</main>
	);
}

export default App;
