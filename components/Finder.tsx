import {
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import {
	type DisplayMode,
	OVERLAY_HEIGHT_VH,
	OVERLAY_WIDTH_PX,
	POPUP_HEIGHT_PX,
	POPUP_WIDTH_PX,
	SEARCH_DEBOUNCE_MS,
} from "@/lib/config";
import { segmentByIndices } from "@/lib/highlight";
import { actionForKey, moveSelection } from "@/lib/keybindings";
import { request } from "@/lib/messages";
import { search } from "@/lib/search/rank";
import type { Candidate, Result, Source } from "@/lib/types";
import "./finder.css";

interface FinderProps {
	variant: DisplayMode;
	onClose: () => void;
}

// Factories, not elements: a Solid JSX element is a single DOM node and can't be shared between rows.
const ICONS: Record<Source, () => JSX.Element> = {
	tab: () => (
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
			<path d="M1.5 5.5h13" />
		</svg>
	),
	bookmark: () => (
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />
		</svg>
	),
	history: () => (
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<circle cx="8" cy="8" r="6.5" />
			<path d="M8 4.5V8l2.5 1.5" />
		</svg>
	),
};

const SOURCE_LABELS: Record<Source, string> = {
	tab: "Open tab",
	bookmark: "Bookmark",
	history: "History",
};

const SIZES: Record<DisplayMode, JSX.CSSProperties> = {
	overlay: {
		width: `min(${OVERLAY_WIDTH_PX}px, calc(100vw - 32px))`,
		height: `${OVERLAY_HEIGHT_VH}vh`,
	},
	popup: { width: `${POPUP_WIDTH_PX}px`, height: `${POPUP_HEIGHT_PX}px` },
};

/** Render text with the characters at `positions` wrapped in <mark>. */
function Highlighted(props: { text: string; positions: number[] }) {
	const segments = createMemo(() =>
		segmentByIndices(props.text, props.positions),
	);
	return (
		<For each={segments()}>
			{(s) => (s.marked ? <mark>{s.text}</mark> : s.text)}
		</For>
	);
}

export function Finder(props: FinderProps) {
	const [query, setQuery] = createSignal("");
	// The query results are ranked for; trails `query` by the debounce delay.
	const [rankedQuery, setRankedQuery] = createSignal("");
	const [candidates, setCandidates] = createSignal<Candidate[]>([]);
	const [theme, setTheme] = createSignal<Record<string, string>>({});
	const [loaded, setLoaded] = createSignal(false);
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal("");
	const [warnings, setWarnings] = createSignal<string[]>([]);
	const [selected, setSelected] = createSignal(0);
	let input!: HTMLInputElement;
	let list!: HTMLDivElement;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;

	const results = createMemo(() => search(candidates(), rankedQuery()));

	createEffect(() => {
		list.children[selected()]?.scrollIntoView({ block: "nearest" });
	});

	onMount(async () => {
		input.focus();
		try {
			const snapshot = await request({ type: "snapshot" });
			if (disposed) return;
			setCandidates(snapshot.candidates);
			setTheme(snapshot.theme);
			setWarnings(snapshot.warnings);
		} catch (reason) {
			if (!disposed) setError(messageOf(reason));
		} finally {
			if (!disposed) setLoaded(true);
		}
	});

	onCleanup(() => {
		disposed = true;
		clearTimeout(timer);
	});

	const rank = (value: string) => {
		clearTimeout(timer);
		if (value === rankedQuery()) return;
		setRankedQuery(value);
		setSelected(0);
	};

	const onInput = (value: string) => {
		setQuery(value);
		clearTimeout(timer);
		timer = setTimeout(() => rank(value), SEARCH_DEBOUNCE_MS);
	};

	/** Send a request that ends the finder's job; on failure, stay open and show why. */
	const finish = async (send: () => Promise<unknown>) => {
		if (busy()) return;
		setBusy(true);
		setError("");
		try {
			await send();
			props.onClose();
		} catch (reason) {
			setError(messageOf(reason));
			setBusy(false);
			input.focus();
		}
	};

	const activate = (result: Result | undefined) => {
		if (!result) return;
		void finish(() => request({ type: "activate", target: result.target }));
	};

	const onKeyDown = (e: KeyboardEvent) => {
		const action = actionForKey(e);
		if (!action) return;
		e.preventDefault();
		e.stopPropagation();
		// Rank any pending keystrokes first, so Enter never acts on results for an older query.
		rank(query());
		switch (action) {
			case "selectNext":
				return setSelected((i) => moveSelection(i, 1, results().length));
			case "selectPrev":
				return setSelected((i) => moveSelection(i, -1, results().length));
			case "activate":
				return activate(results()[selected()]);
			case "searchWeb": {
				const text = query().trim();
				if (text)
					void finish(() => request({ type: "searchWeb", query: text }));
				return;
			}
			case "close":
				return props.onClose();
		}
	};

	const panel = (
		<div
			class={`finder finder--${props.variant}`}
			style={{ ...SIZES[props.variant], ...theme() }}
			role="dialog"
			aria-label="BrowserScope"
		>
			<input
				ref={input}
				class="finder__input"
				type="text"
				placeholder="Search tabs, bookmarks and history"
				spellcheck={false}
				autocomplete="off"
				role="combobox"
				aria-expanded="true"
				aria-controls="bs-results"
				aria-autocomplete="list"
				aria-activedescendant={
					results().length ? `bs-option-${selected()}` : undefined
				}
				value={query()}
				onInput={(e) => onInput(e.currentTarget.value)}
				onKeyDown={onKeyDown}
			/>
			<Show when={error()}>
				<p class="finder__notice finder__notice--error" role="alert">
					{error()}
				</p>
			</Show>
			<Show when={warnings().length}>
				<p class="finder__notice">{warnings().join(" ")}</p>
			</Show>
			<div
				ref={list}
				id="bs-results"
				class="finder__results"
				role="listbox"
				aria-busy={!loaded() || busy()}
			>
				<For each={results()}>
					{(result, i) => (
						// Keyboard selection is handled by the combobox input; clicking is a convenience.
						// biome-ignore lint/a11y/useKeyWithClickEvents: see above
						<div
							id={`bs-option-${i()}`}
							tabIndex={-1}
							class="finder__row"
							classList={{ "finder__row--selected": i() === selected() }}
							role="option"
							aria-selected={i() === selected()}
							title={result.url}
							onMouseMove={() => setSelected(i())}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => activate(result)}
						>
							<span class="finder__icon" title={SOURCE_LABELS[result.source]}>
								{ICONS[result.source]()}
							</span>
							<span class="finder__text">
								<span class="finder__title">
									<Highlighted
										text={result.title}
										positions={result.titleMatches}
									/>
								</span>
								<span class="finder__url">
									<Highlighted
										text={result.url}
										positions={result.urlMatches}
									/>
								</span>
							</span>
						</div>
					)}
				</For>
			</div>
			<Show when={loaded() && results().length === 0}>
				<p class="finder__empty">
					{rankedQuery().trim()
						? "No results. Press Ctrl+Enter to search the web."
						: "No open tabs."}
				</p>
			</Show>
		</div>
	);

	if (props.variant === "popup") return panel;
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: backdrop click is a mouse convenience; Esc closes via keyboard
		// biome-ignore lint/a11y/useKeyWithClickEvents: as above
		<div
			class="finder-backdrop"
			onClick={(e) => e.target === e.currentTarget && props.onClose()}
		>
			{panel}
		</div>
	);
}

function messageOf(reason: unknown): string {
	return reason instanceof Error ? reason.message : String(reason);
}
