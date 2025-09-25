import type htmx from "htmx.org";
import type { HtmxExtension } from "htmx.org";

function registerHoldExtension() {
	const htmxLive: typeof htmx | undefined =
		window?.htmx ||
		(globalThis as typeof globalThis & { htmx?: typeof htmx }).htmx;
	if (!htmxLive) {
		console.error("htmx is not available.");
		return;
	}

	htmxLive.defineExtension("hold", {
		onEvent: (name: string, evt: CustomEvent) => {
			if (name === "htmx:afterProcessNode") {
				const elt = evt.detail.elt as HTMLElement;
				const triggerSpec =
					elt.getAttribute("hx-trigger") || elt.getAttribute("data-hx-trigger");

				if (triggerSpec?.includes("hold") && triggerSpec?.includes("delay")) {
					if (elt._holdSetup) return;
					elt._holdSetup = true;

					const startHold = (e: Event) => {
						e.preventDefault();
						htmxLive.trigger(elt, "hold");
					};

					const cancelHold = () => {
						const internalData = elt["htmx-internal-data"];
						if (internalData?.delayed != null) {
							clearTimeout(internalData.delayed);
							internalData.delayed = null;
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
const htmxLive =
	(typeof window !== "undefined" && window.htmx) ||
	(typeof globalThis !== "undefined" && (globalThis as any).htmx);
if (htmxLive) {
	registerHoldExtension();
} else if (typeof window !== "undefined") {
	document.addEventListener("htmx:load", registerHoldExtension);
} else if (typeof globalThis !== "undefined") {
	// For test environments
	(globalThis as any).addEventListener?.("htmx:load", registerHoldExtension);
}

export default registerHoldExtension;
