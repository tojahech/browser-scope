import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { CONFIG } from "../lib/config";
import { segmentByIndices } from "../lib/highlight";
import { keyAction, moveSelection } from "../lib/keybindings";
import { request } from "../lib/messages";
import { searchCandidates } from "../lib/search";
import type { Candidate, Result } from "../lib/types";

function Highlight(props: { text: string; matches: number[] }) {
	const pieces = createMemo(() => segmentByIndices(props.text, props.matches));
	return (
		<For each={pieces()}>
			{(part) => (part.marked ? <mark>{part.text}</mark> : part.text)}
		</For>
	);
}
export default function Finder(props: { close: () => void }) {
	const [query, setQuery] = createSignal("");
	const [filteredQuery, setFilteredQuery] = createSignal("");
	const [candidates, setCandidates] = createSignal<Candidate[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal("");
	const [warnings, setWarnings] = createSignal<string[]>([]);
	const [theme, setTheme] = createSignal<Record<string, string>>({});
	const [selected, setSelected] = createSignal(0);
	const results = createMemo(() =>
		searchCandidates(candidates(), filteredQuery()),
	);
	let input!: HTMLInputElement;
	let list!: HTMLDivElement;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	onMount(async () => {
		input.focus();
		try {
			const data = await request({ type: "snapshot" });
			if (disposed) return;
			setCandidates(data.candidates);
			setTheme(data.theme);
			setWarnings(data.warnings);
		} catch (reason) {
			if (!disposed) setError(String(reason));
		} finally {
			if (!disposed) setLoading(false);
		}
	});
	onCleanup(() => {
		disposed = true;
		clearTimeout(timer);
	});
	createEffect(() => {
		list
			?.querySelector(`[data-index="${selected()}"]`)
			?.scrollIntoView({ block: "nearest" });
	});
	function update(value: string) {
		setQuery(value);
		clearTimeout(timer);
		timer = setTimeout(() => {
			setFilteredQuery(value);
			setSelected(0);
			list.scrollTop = 0;
		}, CONFIG.searchDebounceMs);
	}
	async function activate(result?: Result, rawSearch = false) {
		if (busy() || (!rawSearch && !result) || (rawSearch && !query().trim()))
			return;
		setBusy(true);
		setError("");
		try {
			if (rawSearch) await request({ type: "search", query: query() });
			else if (result)
				await request({ type: "activate", target: result.target });
			props.close();
		} catch (reason) {
			setError(String(reason));
			setBusy(false);
			input.focus();
		}
	}
	function onKeyDown(event: KeyboardEvent) {
		if (event.key === "Tab") {
			event.preventDefault();
			input.focus();
			return;
		}
		const action = keyAction(event);
		if (!action) return;
		event.preventDefault();
		event.stopPropagation();
		// Flush pending filtering before acting so Enter never uses an older query.
		clearTimeout(timer);
		if (filteredQuery() !== query()) {
			setFilteredQuery(query());
			setSelected(0);
		}
		if (action === "next" || action === "previous")
			setSelected((value) =>
				moveSelection(value, action === "next" ? 1 : -1, results().length),
			);
		else if (action === "close") props.close();
		else void activate(results()[selected()], action === "search");
	}
	return (
		<div class="scope-backdrop">
			<section
				class="scope-panel"
				style={{ ...theme(), "--finder-width": `${CONFIG.width}px` }}
				role="dialog"
				aria-modal="true"
				aria-label="BrowserScope"
				on:keydown={onKeyDown}
			>
				<header>
					<span class="scope-brand">BrowserScope</span>
					<button
						type="button"
						class="scope-close"
						aria-label="Close finder"
						on:click={props.close}
					>
						Esc ×
					</button>
				</header>
				<div class="scope-search">
					<span aria-hidden="true">⌕</span>
					<input
						ref={input}
						aria-label="Search tabs, bookmarks, and history"
						role="combobox"
						aria-expanded="true"
						aria-controls="scope-results"
						aria-autocomplete="list"
						aria-activedescendant={
							results().length ? `scope-result-${selected()}` : undefined
						}
						placeholder="Search tabs, bookmarks, and history…"
						value={query()}
						on:input={(event) => update(event.currentTarget.value)}
						autocomplete="off"
						spellcheck={false}
					/>
				</div>
				<div class="scope-meta" aria-live="polite">
					{loading()
						? "Loading your browser…"
						: `${results().length}${results().length === CONFIG.resultLimit ? "+" : ""} results · ${query().trim() ? "All sources" : "Recent tabs"}`}
				</div>
				<Show when={error()}>
					<p class="scope-error" role="alert">
						{error()}
					</p>
				</Show>
				<Show when={warnings().length}>
					<p class="scope-error">{warnings().join(" ")}</p>
				</Show>
				<div
					ref={list}
					id="scope-results"
					class="scope-results"
					role="listbox"
					aria-label="Search results"
					aria-busy={loading() || busy()}
				>
					<For each={results()}>
						{(result, index) => (
							<div
								id={`scope-result-${index()}`}
								data-index={index()}
								class="scope-result"
								classList={{ selected: selected() === index() }}
								role="option"
								aria-selected={selected() === index()}
								tabIndex={-1}
								on:mousedown={(event) => event.preventDefault()}
								on:click={() => void activate(result)}
								on:keydown={(event) => {
									if (event.key === "Enter") {
										event.stopPropagation();
										void activate(result);
									}
								}}
							>
								<span
									class="scope-icon"
									title={result.source}
									aria-hidden="true"
								>
									{{ tab: "▣", bookmark: "★", history: "◷" }[result.source]}
								</span>
								<div class="scope-details">
									<strong>
										<Highlight
											text={result.title}
											matches={result.titleMatches}
										/>
									</strong>
									<span class="scope-url">
										<Highlight text={result.url} matches={result.urlMatches} />
									</span>
								</div>
								<span class="scope-source">{result.source}</span>
							</div>
						)}
					</For>
					<Show when={!loading() && !results().length}>
						<div class="scope-empty">
							{query().trim()
								? "No matches. Press Ctrl+Enter to search the web."
								: "No open tabs found."}
						</div>
					</Show>
				</div>
				<footer>
					<span>
						<kbd>↑</kbd>
						<kbd>↓</kbd> or Ctrl+J/K
					</span>
					<span>
						<kbd>Enter</kbd> Open
					</span>
					<span>
						<kbd>Ctrl+Enter</kbd> Web search
					</span>
				</footer>
			</section>
		</div>
	);
}
