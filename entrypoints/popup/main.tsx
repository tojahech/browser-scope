import { render } from "solid-js/web";
import { Finder } from "@/components/Finder";
import type { UiRequest } from "@/lib/messages";
import "./style.css";

const root = document.getElementById("root");

if (root === null) {
	throw new Error("Root element not found");
}

browser.runtime.onMessage.addListener((message: UiRequest) => {
	if (message.type === "closeUi") window.close();
});

render(() => <Finder variant="popup" onClose={() => window.close()} />, root);
