import { render } from "solid-js/web";
import type { ShadowRootContentScriptUi } from "wxt/utils/content-script-ui/shadow-root";
import { Finder } from "@/components/Finder";
import { OVERLAY_Z_INDEX } from "@/lib/config";
import type { UiRequest } from "@/lib/messages";
import { sendToBackground } from "@/lib/messages";
import { makePageInert } from "./inert";

export default defineContentScript({
	matches: ["<all_urls>"],
	cssInjectionMode: "ui",

	async main(ctx) {
		let ui: Promise<ShadowRootContentScriptUi<() => void>> | undefined;
		let isOpen = false;
		let previousFocus: Element | null = null;
		let restorePage: (() => void) | undefined;

		const getUi = () => {
			ui ??= createShadowRootUi(ctx, {
				name: "browser-scope-overlay",
				position: "modal",
				// Mount outside <body> so the whole body can be made inert (see inert.ts).
				anchor: () => document.documentElement,
				zIndex: OVERLAY_Z_INDEX,
				isolateEvents: true,
				onMount: (container) =>
					render(() => <Finder variant="overlay" onClose={close} />, container),
				onRemove: (dispose) => dispose?.(),
			});
			return ui;
		};

		async function open() {
			if (isOpen) return;
			isOpen = true;
			previousFocus = document.activeElement;
			const shadowUi = await getUi();
			shadowUi.mount();
			restorePage = makePageInert(shadowUi.shadowHost);
		}

		async function close() {
			if (!isOpen) return;
			isOpen = false;
			restorePage?.();
			restorePage = undefined;
			(await getUi()).remove();
			if (previousFocus instanceof HTMLElement) previousFocus.focus();
		}

		browser.runtime.onMessage.addListener((message: UiRequest) => {
			if (message.type === "toggleOverlay") {
				isOpen ? close() : open();
			} else if (message.type === "closeUi") {
				close();
			}
		});

		// Let the background know it can show the overlay in this tab. Re-announce when the tab becomes
		// visible, in case the background lost track (e.g. it restarted).
		const announce = () => {
			sendToBackground({ type: "overlayReady" }).catch(() => {});
		};
		announce();
		ctx.addEventListener(document, "visibilitychange", () => {
			if (document.visibilityState === "visible") announce();
		});
	},
});
