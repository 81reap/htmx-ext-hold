import type htmx from "htmx.org";

// Static Global Vars
const DEFAULT_HOLD_DELAY = 500; // in milliseconds
const CSS_HOLD_PROGRESS_VAR = "--hold-progress";

// Helper Functions
function parseDelay(triggerSpec: string): number | null {
	const match = triggerSpec.match(/hold\s+delay:(\d+(?:ms|s)?)/);
	return htmxLive.parseInterval(match?.[1]) ?? null;
};

// Extension Registration
function registerHoldExtension() {
	let htmxLive: typeof htmx | undefined;
	if (typeof window !== "undefined") {
		htmxLive = window.htmx;
	} else if (typeof globalThis !== "undefined") {
		htmxLive = (globalThis as any).htmx;
	}
	if (!htmxLive) {
		console.error("htmx is not available.");
		return;
	}

	htmxLive.defineExtension("hold", {
		onEvent: (name: string, evt: CustomEvent): boolean => {
			if (name === "htmx:afterProcessNode") {
				const elt = evt.detail.elt as HTMLElement;
				const triggerSpec =
					elt.getAttribute("hx-trigger") || elt.getAttribute("data-hx-trigger");

				if (triggerSpec?.includes("hold")) {
					const delay = parseDelay(triggerSpec) ?? DEFAULT_HOLD_DELAY;
					if (elt._holdSetup) return true;
					elt._holdSetup = true;

					let startTime: number | null = null;
					let triggered = false;

					const updateProgress = () => {
						if (startTime === null) return;
						const elapsed = Date.now() - startTime;
						const progress = Math.min(elapsed / delay, 1);
						elt.style.setProperty(CSS_HOLD_PROGRESS_VAR, progress.toString());
						if (progress >= 1 && !triggered) {
							triggered = true;
							htmxLive.trigger(elt, "hold");
							const internalData = elt["htmx-internal-data"];
							if (internalData?.holdAnimationId) {
								cancelAnimationFrame(internalData.holdAnimationId);
								internalData.holdAnimationId = null;
							}
						} else {
							const internalData = elt["htmx-internal-data"];
							if (internalData) {
								internalData.holdAnimationId =
									requestAnimationFrame(updateProgress);
							}
						}
					};

					const startHold = (e: Event) => {
						e.preventDefault();
						startTime = Date.now();
						triggered = false;
						htmxLive.addClass(elt, "htmx-hold-active");
						elt.style.setProperty(CSS_HOLD_PROGRESS_VAR, "0");
						const internalData = elt["htmx-internal-data"];
						if (internalData) {
							internalData.holdAnimationId =
								requestAnimationFrame(updateProgress);
						}
					};

					const cancelHold = () => {
						const internalData = elt["htmx-internal-data"];
						if (internalData?.holdAnimationId) {
							cancelAnimationFrame(internalData.holdAnimationId);
							internalData.holdAnimationId = null;
						}
						startTime = null;
						triggered = false;
						htmxLive.removeClass(elt, "htmx-hold-active");
						elt.style.setProperty(CSS_HOLD_PROGRESS_VAR, "0");
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
	});
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
