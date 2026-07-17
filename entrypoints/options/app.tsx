import { createResource, Show } from "solid-js";
import { COMMANDS } from "../../shared/keybindings";

interface Command {
	name: string;
	shortcut: string;
}

async function getLaunchShortcut() {
	const commands = (await browser.commands.getAll()) as Command[];
	return (
		commands.find((command) => command.name === COMMANDS.LAUNCH)?.shortcut ||
		"Not assigned"
	);
}

export default function App() {
	const [shortcut] = createResource(getLaunchShortcut);

	return (
		<main>
			<h1>BrowserScope</h1>
			<section>
				<h2>Launch shortcut</h2>
				<p>
					Current shortcut:{" "}
					<kbd>
						<Show when={!shortcut.loading} fallback="Loading…">
							{shortcut()}
						</Show>
					</kbd>
				</p>
				<p>
					Change it in your browser’s extension-shortcuts settings. Firefox
					exposes this from the gear menu in
					<em> about:addons</em>; Chromium browsers expose it from their
					extensions shortcut page.
				</p>
				<p>
					Press the shortcut twice quickly while BrowserScope is open to switch
					to the previously active tab.
				</p>
			</section>
			<section>
				<h2>Popup keys</h2>
				<ul>
					<li>
						<kbd>Ctrl</kbd> + <kbd>j</kbd> / <kbd>↓</kbd> — next result
					</li>
					<li>
						<kbd>Ctrl</kbd> + <kbd>k</kbd> / <kbd>↑</kbd> — previous result
					</li>
					<li>
						<kbd>Enter</kbd> — open selected result
					</li>
					<li>
						<kbd>Ctrl</kbd> + <kbd>Enter</kbd> — search with the browser’s
						default engine
					</li>
					<li>
						<kbd>Esc</kbd> — close
					</li>
				</ul>
			</section>
		</main>
	);
}
