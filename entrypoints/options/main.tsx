import { createSignal, For, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import { type DisplayMode, LAUNCH_COMMAND } from "@/lib/config";
import { displayMode } from "@/lib/settings";
import "./style.css";

/** Firefox lets extensions rebind their own commands; Chrome only via chrome://extensions/shortcuts. */
interface FirefoxCommands {
	update(detail: { name: string; shortcut: string }): Promise<void>;
	reset(name: string): Promise<void>;
}

const commandsApi = browser.commands as unknown as Partial<FirefoxCommands>;

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

function Options() {
	const [mode, setMode] = createSignal<DisplayMode>();
	const [shortcut, setShortcut] = createSignal("");
	const [shortcutError, setShortcutError] = createSignal("");
	const [saved, setSaved] = createSignal(false);

	const loadShortcut = async () => {
		const commands = await browser.commands.getAll();
		setShortcut(
			commands.find((c) => c.name === LAUNCH_COMMAND)?.shortcut ?? "",
		);
	};

	onMount(async () => {
		setMode(await displayMode.getValue());
		await loadShortcut();
	});

	const changeMode = async (value: DisplayMode) => {
		setMode(value);
		await displayMode.setValue(value);
	};

	const saveShortcut = async (e: SubmitEvent) => {
		e.preventDefault();
		setShortcutError("");
		setSaved(false);
		try {
			await commandsApi.update?.({
				name: LAUNCH_COMMAND,
				shortcut: shortcut(),
			});
			setSaved(true);
		} catch (err) {
			setShortcutError(err instanceof Error ? err.message : String(err));
		}
	};

	const resetShortcut = async () => {
		setShortcutError("");
		await commandsApi.reset?.(LAUNCH_COMMAND);
		await loadShortcut();
		setSaved(true);
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
				<Show
					when={commandsApi.update}
					fallback={
						<p>
							Current: <kbd>{shortcut() || "not set"}</kbd>{" "}
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
					<form onSubmit={saveShortcut}>
						<input
							type="text"
							value={shortcut()}
							onInput={(e) => {
								setShortcut(e.currentTarget.value);
								setSaved(false);
							}}
							placeholder="e.g. Ctrl+Space"
						/>{" "}
						<button type="submit">Save</button>{" "}
						<button type="button" onClick={resetShortcut}>
							Reset
						</button>
					</form>
					<small>
						Format: modifiers and a key joined by <kbd>+</kbd>, e.g.{" "}
						<kbd>Ctrl+Space</kbd> or <kbd>Alt+Shift+P</kbd>. Also editable under
						Manage Extension Shortcuts in about:addons.
					</small>
					<Show when={shortcutError()}>
						<p class="error">{shortcutError()}</p>
					</Show>
					<Show when={saved()}>
						<p class="saved">Saved.</p>
					</Show>
				</Show>
				<small>
					Press the shortcut twice quickly to jump to your previous tab.
				</small>
			</fieldset>
		</main>
	);
}

const root = document.getElementById("root");

if (root === null) {
	throw new Error("Root element not found");
}

render(() => <Options />, root);
