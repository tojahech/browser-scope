import { createSignal, For, onMount, Show } from "solid-js";
import { browser } from "wxt/browser";
import {
	KEYBINDINGS,
	type KeyBinding,
	shortcutFromEvent,
} from "../../lib/keybindings";

const isMac = navigator.platform.toLowerCase().includes("mac");

const LAUNCH_COMMAND =
	import.meta.env.MANIFEST_VERSION === 2
		? "_execute_browser_action"
		: "_execute_action";

/** Firefox-only pieces of the commands API (Chrome cannot rebind programmatically). */
interface CommandsApi {
	update?: (detail: { name: string; shortcut: string }) => Promise<void>;
	reset?: (name: string) => Promise<void>;
}

const commandsApi = browser.commands as unknown as CommandsApi;

const BINDING_LABELS: Record<keyof typeof KEYBINDINGS, string> = {
	moveDown: "Move selection down",
	moveUp: "Move selection up",
	confirm: "Action selected result",
	webSearch: "Web-search the query in a new tab",
	close: "Close popup",
};

function formatBinding(binding: KeyBinding): string {
	const parts: string[] = [];
	if (binding.ctrl) parts.push("Ctrl");
	if (binding.alt) parts.push("Alt");
	if (binding.shift) parts.push("Shift");
	if (binding.meta) parts.push(isMac ? "Cmd" : "Meta");
	parts.push(binding.key === " " ? "Space" : binding.key);
	return parts.join("+");
}

function App() {
	const [shortcut, setShortcut] = createSignal("");
	const [status, setStatus] = createSignal("");

	async function refreshShortcut() {
		const commands = await browser.commands.getAll();
		const launch = commands.find((c) => c.name === LAUNCH_COMMAND);
		setShortcut(launch?.shortcut || "(not set)");
	}

	onMount(() => void refreshShortcut());

	async function onCaptureKeyDown(e: KeyboardEvent) {
		e.preventDefault();
		if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
		const next = shortcutFromEvent(e, isMac);
		if (next === null) {
			setStatus("Use a modifier (Ctrl/Alt) plus a key, e.g. Ctrl+Space.");
			return;
		}
		if (commandsApi.update === undefined) return;
		try {
			await commandsApi.update({ name: LAUNCH_COMMAND, shortcut: next });
			setStatus(`Saved: ${next}`);
			await refreshShortcut();
		} catch (err) {
			setStatus(
				`Could not set ${next}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	async function onReset() {
		if (commandsApi.reset === undefined) return;
		await commandsApi.reset(LAUNCH_COMMAND);
		setStatus("Reset to default.");
		await refreshShortcut();
	}

	return (
		<main>
			<h1>BrowserScope</h1>

			<section>
				<h2>Launch shortcut</h2>
				<p>
					Current: <kbd>{shortcut()}</kbd>
				</p>
				<Show
					when={commandsApi.update !== undefined}
					fallback={
						<p>
							Change it at{" "}
							<button
								type="button"
								class="link"
								onClick={() =>
									void browser.tabs.create({
										url: "chrome://extensions/shortcuts",
									})
								}
							>
								chrome://extensions/shortcuts
							</button>
							.
						</p>
					}
				>
					<p>
						<input
							type="text"
							readonly
							placeholder="Click, then press the new shortcut"
							onKeyDown={(e) => void onCaptureKeyDown(e)}
						/>
						<button type="button" onClick={() => void onReset()}>
							Reset to default
						</button>
					</p>
					<p class="status">{status()}</p>
				</Show>
				<p class="hint">
					Pressing the launch shortcut twice in quick succession switches
					straight to the previously active tab.
				</p>
			</section>

			<section>
				<h2>Popup keys</h2>
				<table>
					<tbody>
						<For each={Object.entries(KEYBINDINGS)}>
							{([name, bindings]) => (
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
									<td>{BINDING_LABELS[name as keyof typeof KEYBINDINGS]}</td>
								</tr>
							)}
						</For>
					</tbody>
				</table>
			</section>
		</main>
	);
}

export default App;
