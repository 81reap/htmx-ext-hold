import type { HtmxExtension, HtmxResponseInfo } from "htmx.org";

type HtmxEvent = Event & { detail: HtmxResponseInfo };

function registerHoldExtension() {
	const htmx = window?.htmx || (globalThis as any)?.htmx;
	if (!htmx) {
		console.error("htmx is not available.");
		return;
	}

	htmx.defineExtension("hold", {
		onEvent: (name: string, evt: CustomEvent) => {
			if (name === "htmx:afterProcessNode") {
				const elt = evt.detail.elt as HTMLElement;
				const triggerSpec =
					elt.getAttribute("hx-trigger") || elt.getAttribute("data-hx-trigger");

				if (triggerSpec?.includes("hold")) {
					if ((elt as any)._holdSetup) return;
					(elt as any)._holdSetup = true;

					// Parse delay from triggerSpec, e.g., 'hold delay:500ms' -> 500
					let delay = 500; // default 500ms
					const delayMatch = triggerSpec.match(/hold\s+delay:(\d+)ms/);
					if (delayMatch?.[1]) {
						delay = parseInt(delayMatch[1], 10);
					}

					let holdTimeout: number | null = null;

					const startHold = (e: Event) => {
						e.preventDefault();
						if (holdTimeout != null) clearTimeout(holdTimeout);
						holdTimeout = setTimeout(() => {
							htmx.trigger(elt, "hold");
							holdTimeout = null;
						}, delay) as any;
					};

					const cancelHold = () => {
						if (holdTimeout != null) {
							clearTimeout(holdTimeout);
							holdTimeout = null;
						}
					};

					elt.addEventListener("mousedown", startHold);
					elt.addEventListener("touchstart", startHold);
					elt.addEventListener("mouseup", cancelHold);
					elt.addEventListener("mouseleave", cancelHold);
					elt.addEventListener("touchend", cancelHold);
					elt.addEventListener("touchcancel", cancelHold);
				}
			}
			return true;
		},
	} as HtmxExtension);
}

// Auto-register if htmx is already available, otherwise wait for it
const htmx =
	(window?.htmx) ||
	(typeof globalThis !== "undefined" && (globalThis as any).htmx);
if (htmx) {
	registerHoldExtension();
} else if (typeof window !== "undefined") {
	document.addEventListener("htmx:load", registerHoldExtension);
} else if (typeof globalThis !== "undefined") {
	// For test environments
	(globalThis as any).addEventListener?.("htmx:load", registerHoldExtension);
}

export default registerHoldExtension;
