const DEFAULT_HOLD_DELAY = 500; // milliseconds
const CSS_HOLD_PROGRESS_VAR = "--hold-progress";
const HOLD_ACTIVE_CLASS = "htmx-hold-active";
const START_EVENTS = ["mousedown", "touchstart"] as const;
const CANCEL_EVENTS = [
	"mouseup",
	"mouseleave",
	"touchend",
	"touchcancel",
] as const;
const HOLD_TRIGGER_PATTERN = /\bhold\b/;
const DATA_PROGRESS_ATTR = "holdProgress";

const processedElements = new WeakSet<HTMLElement>();

function parseDelay(
	triggerSpec: string,
	htmx: NonNullable<typeof window.htmx>,
): number | null {
	const match = triggerSpec.match(/hold\s+delay:(\d+(?:\.\d+)?(?:ms|s)?)/);
	if (!match?.[1]) return null;
	return htmx.parseInterval?.(match[1]) ?? null;
}

function registerElement(
	elt: HTMLElement,
	triggerSpec: string,
	htmx: NonNullable<typeof window.htmx>,
) {
	if (processedElements.has(elt)) return;
	const delay = parseDelay(triggerSpec, htmx) ?? DEFAULT_HOLD_DELAY;
	let startTime: number | null = null;
	let animationFrameId: number | null = null;
	let holdTriggered = false;
	let isActive = false;

	const clearAnimation = () => {
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}
	};

	const updateProgress = () => {
		if (startTime === null) return;
		const elapsed = Date.now() - startTime;
		const progress = Math.min(elapsed / delay, 1);
		elt.style.setProperty(CSS_HOLD_PROGRESS_VAR, progress.toString());
		elt.dataset[DATA_PROGRESS_ATTR] = Math.round(progress * 100).toString();

		if (progress >= 1 && !holdTriggered) {
			holdTriggered = true;
			clearAnimation();
			htmx.trigger?.(elt, "hold");
		} else if (!holdTriggered) {
			animationFrameId = requestAnimationFrame(updateProgress);
		}
	};

	START_EVENTS.forEach((eventName) => {
		elt.addEventListener(eventName, (event: Event) => {
			if (isActive) return;
			if (event.cancelable) event.preventDefault();
			isActive = true;
			holdTriggered = false;
			startTime = Date.now();
			htmx.addClass?.(elt, HOLD_ACTIVE_CLASS);
			elt.style.setProperty(CSS_HOLD_PROGRESS_VAR, "0");
			elt.dataset[DATA_PROGRESS_ATTR] = "0";
			animationFrameId = requestAnimationFrame(updateProgress);
		});
	});

	CANCEL_EVENTS.forEach((eventName) => {
		elt.addEventListener(eventName, () => {
			if (!isActive) return;
			isActive = false;
			startTime = null;
			holdTriggered = false;
			clearAnimation();
			htmx.removeClass?.(elt, HOLD_ACTIVE_CLASS);
			elt.style.setProperty(CSS_HOLD_PROGRESS_VAR, "0");
			elt.dataset[DATA_PROGRESS_ATTR] = "0";
		});
	});

	processedElements.add(elt);
}

function registerHoldExtension() {
	const htmx = window.htmx;
	if (!htmx || typeof htmx.defineExtension !== "function") {
		console.error("htmx is not available.");
		return;
	}

	htmx.defineExtension("hold", {
		onEvent(name: string, evt: CustomEvent) {
			if (name !== "htmx:afterProcessNode") return true;
			const elt = evt.detail.elt as HTMLElement | undefined;
			if (!elt) return true;
			const triggerSpec =
				elt.getAttribute("hx-trigger") ?? elt.getAttribute("data-hx-trigger");
			if (!triggerSpec || !HOLD_TRIGGER_PATTERN.test(triggerSpec)) return true;
			registerElement(elt, triggerSpec, htmx);
			return true;
		},
	});
}

if (typeof window !== "undefined") {
	if (window.htmx) {
		registerHoldExtension();
	} else if (typeof document !== "undefined") {
		document.addEventListener("htmx:load", registerHoldExtension, {
			once: true,
		});
	}
}

export default registerHoldExtension;
