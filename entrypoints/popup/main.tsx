import { render } from "solid-js/web";
import { browser } from "wxt/browser";
import { Finder } from "@/components/Finder";
import type { UiMessage } from "@/lib/messages";
import "./style.css";

const root = document.getElementById("root");

if (root === null) {
	throw new Error("Root element not found");
}

browser.runtime.onMessage.addListener((message: UiMessage) => {
	if (message.type === "closeUi") window.close();
});

render(() => <Finder variant="popup" onClose={() => window.close()} />, root);
