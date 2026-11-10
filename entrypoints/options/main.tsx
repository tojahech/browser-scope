import { createSignal, For, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import { browser } from "wxt/browser";
import { canUpdateCommands, firefox } from "@/lib/browser-compat";
import { type DisplayMode, DOUBLE_TAP_MS, LAUNCH_COMMAND } from "@/lib/config";
import {
	ACTION_LABELS,
	type Action,
	formatBinding,
	KEYBINDINGS,
	shortcutFromEvent,
} from "@/lib/keybindings";
import { displayMode } from "@/lib/settings";
import "./style.css";

const isMac = navigator.platform.toLowerCase().includes("mac");

const MODES: { value: DisplayMode; label: string; hint: string }[] = [
	{
		value: "overlay",
		label: "In page",
		hint: "Overlay centred on the current page. Falls back to the toolbar popup on pages extensions can't access.",
	},
	{
		value: "popup",
		label: "Toolbar popup",
		hint: "Open from the toolbar button. Works on every page.",
	},
];

/** Keybindings grouped by action, in table order. */
const KEY_TABLE = Object.entries(
	Object.groupBy(KEYBINDINGS, (binding) => binding.action),
) as [Action, typeof KEYBINDINGS][];

function Options() {
	const [mode, setMode] = createSignal<DisplayMode>();
	const [shortcut, setShortcut] = createSignal("");
	const [status, setStatus] = createSignal("");

	const refreshShortcut = async () => {
		const commands = await browser.commands.getAll();
		setShortcut(
			commands.find((c) => c.name === LAUNCH_COMMAND)?.shortcut || "not set",
		);
	};

	onMount(async () => {
		setMode(await displayMode.getValue());
		await refreshShortcut();
	});

	const changeMode = async (value: DisplayMode) => {
		setMode(value);
		await displayMode.setValue(value);
	};

	/** Press-to-capture: the next key combination pressed in the field becomes the shortcut. */
	const capture = async (e: KeyboardEvent) => {
		if (e.key === "Tab") return;
		e.preventDefault();
		if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
		const next = shortcutFromEvent(e, isMac);
		if (next === null) {
			setStatus("Use a modifier (Ctrl or Alt) plus a key, e.g. Ctrl+Space.");
			return;
		}
		try {
			await firefox.commands.update?.({ name: LAUNCH_COMMAND, shortcut: next });
			setStatus(`Saved ${next}.`);
			await refreshShortcut();
		} catch (err) {
			setStatus(
				`Could not use ${next}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	};

	const reset = async () => {
		await firefox.commands.reset?.(LAUNCH_COMMAND);
		setStatus("Reset to the default.");
		await refreshShortcut();
	};

	return (
		<main>
			<fieldset>
				<legend>Display</legend>
				<For each={MODES}>
					{(m) => (
						<label class="option">
							<input
								type="radio"
								name="mode"
								value={m.value}
								checked={mode() === m.value}
								onChange={() => changeMode(m.value)}
							/>
							<span>
								{m.label}
								<small>{m.hint}</small>
							</span>
						</label>
					)}
				</For>
			</fieldset>

			<fieldset>
				<legend>Launch shortcut</legend>
				<p class="status">
					Current: <kbd>{shortcut()}</kbd>
				</p>
				<Show
					when={canUpdateCommands()}
					fallback={
						<p>
							<button
								type="button"
								onClick={() =>
									browser.tabs.create({ url: "chrome://extensions/shortcuts" })
								}
							>
								Change in browser settings
							</button>
						</p>
					}
				>
					<p>
						<input
							type="text"
							readonly
							placeholder="Click, then press the new shortcut"
							onKeyDown={(e) => void capture(e)}
						/>{" "}
						<button type="button" onClick={() => void reset()}>
							Reset
						</button>
					</p>
					<p class="status" aria-live="polite">
						{status()}
					</p>
				</Show>
				<small>
					Press the shortcut twice within {DOUBLE_TAP_MS} ms to jump to your
					previous tab.
				</small>
			</fieldset>

			<fieldset>
				<legend>Keys in the finder</legend>
				<table>
					<tbody>
						<For each={KEY_TABLE}>
							{([action, bindings]) => (
								<tr>
									<td>
										<For each={bindings}>
											{(binding, i) => (
												<>
													{i() > 0 && " / "}
													<kbd>{formatBinding(binding)}</kbd>
												</>
											)}
										</For>
									</td>
									<td>{ACTION_LABELS[action]}</td>
								</tr>
							)}
						</For>
					</tbody>
				</table>
			</fieldset>
		</main>
	);
}

const root = document.getElementById("root");

if (root === null) {
	throw new Error("Root element not found");
}

render(() => <Options />, root);
