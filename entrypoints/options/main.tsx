import { createSignal, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import { browser } from "wxt/browser";
import { CONFIG } from "../../lib/config";
import { firefox } from "../../lib/firefox";
import "./style.css";
function Options() {
	const [shortcut, setShortcut] = createSignal("");
	const [status, setStatus] = createSignal("");
	async function refresh() {
		const commands = await browser.commands.getAll();
		setShortcut(
			commands.find((command) => command.name === CONFIG.command)?.shortcut ??
				"",
		);
	}
	onMount(() => {
		void refresh().catch((error) => setStatus(String(error)));
	});
	async function save(reset = false) {
		try {
			if (reset) await firefox.commands.reset(CONFIG.command);
			else
				await firefox.commands.update({
					name: CONFIG.command,
					shortcut: shortcut().trim(),
				});
			await refresh();
			setStatus("Shortcut saved.");
		} catch (error) {
			setStatus(`Could not save shortcut: ${String(error)}`);
		}
	}
	return (
		<main>
			<h1>BrowserScope</h1>
			<p>A keyboard-driven finder for your browser.</p>
			<h2>Launch shortcut</h2>
			<p>
				Press once to open the finder. Press twice within {CONFIG.doubleTapMs}{" "}
				ms to switch to the previously focused tab.
			</p>
			<label for="shortcut">Current shortcut</label>
			<input
				id="shortcut"
				value={shortcut()}
				readOnly={!import.meta.env.FIREFOX}
				placeholder="Not assigned"
				onInput={(event) => setShortcut(event.currentTarget.value)}
			/>
			<Show
				when={import.meta.env.FIREFOX}
				fallback={
					<p>
						Change the shortcut in <code>chrome://extensions/shortcuts</code>.
						Copy that address into your address bar.
					</p>
				}
			>
				<p>
					Use a shortcut such as <code>{CONFIG.defaultShortcut}</code> or{" "}
					<code>Alt+K</code>.
				</p>
				<div>
					<button type="button" onClick={() => void save()}>
						Save shortcut
					</button>
					<button type="button" onClick={() => void save(true)}>
						Restore default
					</button>
				</div>
				<p>
					You can also change it in Firefox: Add-ons and themes → gear menu →
					Manage Extension Shortcuts.
				</p>
			</Show>
			<output>{status()}</output>
			<h2>Inside the finder</h2>
			<p>
				Ctrl+J / ↓ and Ctrl+K / ↑ select a result. Enter opens it. Ctrl+Enter
				searches with your default search engine. Esc closes the finder.
			</p>
			<h2>Search scope</h2>
			<p>
				Search includes all open tabs, all bookmarks, and the{" "}
				{CONFIG.historyLimit.toLocaleString()} most recent history entries. An
				empty query shows recent tabs. Matching runs locally; BrowserScope sends
				no data to a server.
			</p>
			<p>
				Browser-owned pages and extension stores restrict overlays. BrowserScope
				opens a separate finder window there. If your operating system reserves
				the shortcut, choose another one above or in the browser’s shortcut
				settings.
			</p>
		</main>
	);
}
const root = document.getElementById("root");
if (root) render(() => <Options />, root);
