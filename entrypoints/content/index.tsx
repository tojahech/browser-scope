import { render } from "solid-js/web";
import { browser } from "wxt/browser";
import Finder from "../../components/Finder";
import "../../components/finder.css";

export default defineContentScript({
	matches: ["<all_urls>"],
	cssInjectionMode: "ui",
	async main(ctx) {
		let previousFocus: HTMLElement | null = null;
		let mounted = false;
		const ui = await createShadowRootUi(ctx, {
			name: "browser-scope",
			mode: "closed",
			position: "overlay",
			zIndex: 2147483647,
			isolateEvents: ["keydown", "keyup", "keypress"],
			onMount(container) {
				return render(() => <Finder close={close} />, container);
			},
			onRemove(dispose) {
				dispose?.();
			},
		});
		function close() {
			if (!mounted) return;
			ui.remove();
			mounted = false;
			previousFocus?.focus({ preventScroll: true });
		}
		const listener = (message: { type?: string }) => {
			if (message.type === "open-finder") {
				if (!mounted) {
					previousFocus =
						document.activeElement instanceof HTMLElement
							? document.activeElement
							: null;
					mounted = true;
					ui.mount();
				}
				return Promise.resolve(true);
			}
			if (message.type === "close-finder") {
				close();
				return Promise.resolve(true);
			}
		};
		browser.runtime.onMessage.addListener(listener);
		ctx.onInvalidated(() => {
			close();
			browser.runtime.onMessage.removeListener(listener);
		});
	},
});
