import {
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	on,
	onMount,
	Show,
} from "solid-js";
import {
	type DisplayMode,
	MAX_RESULTS,
	OVERLAY_HEIGHT_VH,
	OVERLAY_WIDTH_PX,
	POPUP_HEIGHT_PX,
	POPUP_WIDTH_PX,
	type SourceKind,
} from "@/lib/config";
import { actionForKey } from "@/lib/keybindings";
import { sendToBackground } from "@/lib/messages";
import { type Candidate, dedupe, type Result, search } from "@/lib/search";
import { applyTheme } from "@/lib/theme";
import "./finder.css";

interface FinderProps {
	variant: DisplayMode;
	onClose: () => void;
}

// Factories, not elements: a Solid JSX element is a single DOM node and can't be shared between rows.
const ICONS: Record<SourceKind, () => JSX.Element> = {
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

const SIZES: Record<DisplayMode, JSX.CSSProperties> = {
	overlay: {
		width: `min(${OVERLAY_WIDTH_PX}px, calc(100vw - 32px))`,
		height: `${OVERLAY_HEIGHT_VH}vh`,
	},
	popup: { width: `${POPUP_WIDTH_PX}px`, height: `${POPUP_HEIGHT_PX}px` },
};

const KIND_LABELS: Record<SourceKind, string> = {
	tab: "Open tab",
	bookmark: "Bookmark",
	history: "History",
};

/** Render text with the characters at `positions` wrapped in <mark>. */
function Highlighted(props: { text: string; positions: number[] }) {
	const segments = createMemo(() => {
		const out: { text: string; match: boolean }[] = [];
		const matched = new Set(props.positions);
		for (let i = 0; i < props.text.length; i++) {
			const match = matched.has(i);
			const last = out[out.length - 1];
			if (last && last.match === match) last.text += props.text[i];
			else out.push({ text: props.text[i], match });
		}
		return out;
	});
	return (
		<For each={segments()}>
			{(s) => (s.match ? <mark>{s.text}</mark> : s.text)}
		</For>
	);
}

export function Finder(props: FinderProps) {
	const [query, setQuery] = createSignal("");
	const [candidates, setCandidates] = createSignal<Candidate[]>([]);
	const [loaded, setLoaded] = createSignal(false);
	const [selected, setSelected] = createSignal(0);
	let root!: HTMLDivElement;
	let input!: HTMLInputElement;
	let list!: HTMLDivElement;

	const results = createMemo(() => search(query(), candidates(), MAX_RESULTS));

	createEffect(on(results, () => setSelected(0)));
	createEffect(() => {
		list.children[selected()]?.scrollIntoView({ block: "nearest" });
	});

	onMount(async () => {
		input.focus();
		const response = await sendToBackground({ type: "getCandidates" });
		applyTheme(root, response.theme);
		setCandidates(dedupe(response.candidates));
		setLoaded(true);
	});

	const activate = async (result: Result | undefined) => {
		if (!result) return;
		await sendToBackground({ type: "activate", candidate: result.candidate });
		props.onClose();
	};

	const move = (delta: number) => {
		const count = results().length;
		if (count) setSelected((i) => (i + delta + count) % count);
	};

	const onKeyDown = (e: KeyboardEvent) => {
		const action = actionForKey(e);
		if (!action) return;
		e.preventDefault();
		e.stopPropagation();
		switch (action) {
			case "selectNext":
				return move(1);
			case "selectPrev":
				return move(-1);
			case "activate":
				return activate(results()[selected()]);
			case "searchWeb": {
				const q = query().trim();
				if (!q) return;
				return sendToBackground({ type: "searchWeb", query: q }).then(
					props.onClose,
				);
			}
			case "close":
				return props.onClose();
		}
	};

	const panel = (
		<div
			ref={root}
			class={`finder finder--${props.variant}`}
			style={SIZES[props.variant]}
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
				aria-activedescendant={`bs-option-${selected()}`}
				value={query()}
				onInput={(e) => setQuery(e.currentTarget.value)}
				onKeyDown={onKeyDown}
			/>
			<div ref={list} id="bs-results" class="finder__results" role="listbox">
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
							title={result.candidate.url}
							onMouseMove={() => setSelected(i())}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => activate(result)}
						>
							<span
								class="finder__icon"
								title={KIND_LABELS[result.candidate.kind]}
							>
								{ICONS[result.candidate.kind]()}
							</span>
							<span class="finder__text">
								<span class="finder__title">
									<Highlighted
										text={result.candidate.title}
										positions={result.titlePositions}
									/>
								</span>
								<span class="finder__url">
									<Highlighted
										text={result.candidate.url}
										positions={result.urlPositions}
									/>
								</span>
							</span>
						</div>
					)}
				</For>
			</div>
			<Show when={loaded() && results().length === 0}>
				<p class="finder__empty">
					No results. Press Ctrl+Enter to search the web.
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
