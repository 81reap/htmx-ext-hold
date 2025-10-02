import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { HtmxExtension } from "htmx.org";
import registerHoldExtension from "../src/index";

type MockHtmx = {
	defineExtension: ReturnType<typeof mock>;
	trigger: ReturnType<typeof mock>;
	addClass: ReturnType<typeof mock>;
	removeClass: ReturnType<typeof mock>;
	parseInterval: ReturnType<typeof mock>;
};

let mockHtmx: MockHtmx;
let holdExtension: Partial<HtmxExtension> | undefined;
const HOLD_EVENT = "htmx:afterProcessNode";

function createHoldEvent(elt: HTMLElement) {
	return new CustomEvent(HOLD_EVENT, { detail: { elt } });
}

function createElement(trigger?: string): HTMLElement {
	const element = document.createElement("button");
	if (trigger !== undefined) element.setAttribute("hx-trigger", trigger);
	return element;
}

function dispatchStart(element: HTMLElement, type: "mousedown" | "touchstart") {
	const event = new Event(type, { bubbles: true, cancelable: true });
	element.dispatchEvent(event);
	return event;
}

function dispatchCancel(element: HTMLElement, type: string) {
	element.dispatchEvent(new Event(type, { bubbles: true }));
}

function setupExtension() {
	if (!holdExtension?.onEvent) throw new Error("Hold extension not registered");
	return holdExtension;
}

beforeEach(() => {
	mockHtmx = {
		defineExtension: mock((name: string, extension: Partial<HtmxExtension>) => {
			if (name === "hold") holdExtension = extension;
		}),
		trigger: mock(),
		addClass: mock(),
		removeClass: mock(),
		parseInterval: mock((value: string) => {
			const match = value.match(/^(\d+(?:\.\d+)?)(ms|s)?$/);
			if (!match) return undefined;
			const [, raw, unit] = match;
			if (!raw) return undefined;
			const base = Number.parseFloat(raw);
			return unit === "s" ? base * 1000 : base;
		}),
	};

	window.htmx = mockHtmx as unknown as typeof window.htmx;
	registerHoldExtension();
});

afterEach(() => {
	window.htmx = undefined;
	holdExtension = undefined;
});

test("registers the hold extension with htmx", () => {
	expect(mockHtmx.defineExtension).toHaveBeenCalledWith(
		"hold",
		expect.objectContaining({ onEvent: expect.any(Function) }),
	);
});

test("ignores elements without a hold trigger", () => {
	const extension = setupExtension();
	const element = createElement("click");

	extension.onEvent?.(HOLD_EVENT, createHoldEvent(element));
	dispatchStart(element, "mousedown");

	expect(mockHtmx.addClass).not.toHaveBeenCalled();
	expect(mockHtmx.trigger).not.toHaveBeenCalled();
});

test("activates hold state on mousedown and prevents default", () => {
	const extension = setupExtension();
	const element = createElement("hold delay:200ms");

	extension.onEvent?.(HOLD_EVENT, createHoldEvent(element));
	const event = dispatchStart(element, "mousedown");

	expect(event.defaultPrevented).toBe(true);
	expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
	expect(element.style.getPropertyValue("--hold-progress")).toBe("0");
	expect(element.dataset.holdProgress).toBe("0");
});

test("touchstart events also activate hold state", () => {
	const extension = setupExtension();
	const element = createElement("hold delay:200ms");

	extension.onEvent?.(HOLD_EVENT, createHoldEvent(element));
	const event = dispatchStart(element, "touchstart");

	expect(event.defaultPrevented).toBe(true);
	expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
});

test("hold completes after the configured delay and triggers once", () => {
	const extension = setupExtension();
	const element = createElement("hold delay:0.2s");

	const callbacks: FrameRequestCallback[] = [];
	let nextFrameId = 1;
	const originalRAF = window.requestAnimationFrame;
	const originalCAF = window.cancelAnimationFrame;
	const originalNow = Date.now;
	let now = 0;

	window.requestAnimationFrame = mock((cb: FrameRequestCallback) => {
		callbacks.push(cb);
		return nextFrameId++;
	});
	window.cancelAnimationFrame = mock((_handle: number) => {});
	Date.now = () => now;

	try {
		extension.onEvent?.(HOLD_EVENT, createHoldEvent(element));
		now = 0;
		dispatchStart(element, "mousedown");

		expect(callbacks).toHaveLength(1);
		expect(element.style.getPropertyValue("--hold-progress")).toBe("0");
		expect(element.dataset.holdProgress).toBe("0");

		now = 100;
		callbacks[0]?.(now);
		expect(element.style.getPropertyValue("--hold-progress")).toBe("0.5");
		expect(element.dataset.holdProgress).toBe("50");
		expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);

		now = 210;
		callbacks[1]?.(now);
		expect(element.style.getPropertyValue("--hold-progress")).toBe("1");
		expect(element.dataset.holdProgress).toBe("100");
		expect(mockHtmx.trigger).toHaveBeenCalledTimes(1);
		expect(window.cancelAnimationFrame).toHaveBeenCalledWith(2);
	} finally {
		window.requestAnimationFrame = originalRAF;
		window.cancelAnimationFrame = originalCAF;
		Date.now = originalNow;
	}
});

test("uses default delay when no delay is specified", () => {
	const extension = setupExtension();
	const element = createElement("hold");

	const callbacks: FrameRequestCallback[] = [];
	let nextFrameId = 1;
	const originalRAF = window.requestAnimationFrame;
	const originalCAF = window.cancelAnimationFrame;
	const originalNow = Date.now;
	let now = 0;

	window.requestAnimationFrame = mock((cb: FrameRequestCallback) => {
		callbacks.push(cb);
		return nextFrameId++;
	});
	window.cancelAnimationFrame = mock((_handle: number) => {});
	Date.now = () => now;

	try {
		extension.onEvent?.(HOLD_EVENT, createHoldEvent(element));
		now = 0;
		dispatchStart(element, "mousedown");

		expect(callbacks).toHaveLength(1);
		expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
		expect(element.dataset.holdProgress).toBe("0");

		now = 250;
		callbacks[0]?.(now);
		expect(element.style.getPropertyValue("--hold-progress")).toBe("0.5");
		expect(element.dataset.holdProgress).toBe("50");
		expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);

		now = 520;
		callbacks[1]?.(now);
		expect(element.style.getPropertyValue("--hold-progress")).toBe("1");
		expect(element.dataset.holdProgress).toBe("100");
		expect(mockHtmx.trigger).toHaveBeenCalledWith(element, "hold");
	} finally {
		window.requestAnimationFrame = originalRAF;
		window.cancelAnimationFrame = originalCAF;
		Date.now = originalNow;
	}
});

test("cancelling a hold resets state and cancels animation", () => {
	const extension = setupExtension();
	const element = createElement("hold delay:150ms");

	const originalRAF = window.requestAnimationFrame;
	const originalCAF = window.cancelAnimationFrame;
	window.requestAnimationFrame = mock((_cb: FrameRequestCallback) => 7);
	window.cancelAnimationFrame = mock((_handle: number) => {});

	try {
		extension.onEvent?.(HOLD_EVENT, createHoldEvent(element));
		dispatchStart(element, "mousedown");
		dispatchCancel(element, "mouseup");

		expect(window.cancelAnimationFrame).toHaveBeenCalledWith(7);
		expect(mockHtmx.removeClass).toHaveBeenCalledWith(
			element,
			"htmx-hold-active",
		);
		expect(element.style.getPropertyValue("--hold-progress")).toBe("0");
		expect(element.dataset.holdProgress).toBe("0");
	} finally {
		window.requestAnimationFrame = originalRAF;
		window.cancelAnimationFrame = originalCAF;
	}
});

test("touchcancel events reset progress and remove active class", () => {
	const extension = setupExtension();
	const element = createElement("hold delay:180ms");

	const originalRAF = window.requestAnimationFrame;
	const originalCAF = window.cancelAnimationFrame;
	window.requestAnimationFrame = mock((_cb: FrameRequestCallback) => 42);
	window.cancelAnimationFrame = mock((_handle: number) => {});

	try {
		extension.onEvent?.(HOLD_EVENT, createHoldEvent(element));
		dispatchStart(element, "touchstart");
		element.dispatchEvent(new Event("touchcancel"));

		expect(window.cancelAnimationFrame).toHaveBeenCalledWith(42);
		expect(mockHtmx.removeClass).toHaveBeenCalledWith(
			element,
			"htmx-hold-active",
		);
		expect(element.dataset.holdProgress).toBe("0");
	} finally {
		window.requestAnimationFrame = originalRAF;
		window.cancelAnimationFrame = originalCAF;
	}
});

test("starting a hold while already active is ignored", () => {
	const extension = setupExtension();
	const element = createElement("hold delay:120ms");

	const originalRAF = window.requestAnimationFrame;
	window.requestAnimationFrame = mock((_cb: FrameRequestCallback) => {
		// schedule but never invoke during this test
		return 1;
	});

	try {
		extension.onEvent?.(HOLD_EVENT, createHoldEvent(element));
		const first = dispatchStart(element, "mousedown");
		expect(first.defaultPrevented).toBe(true);
		expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

		const second = dispatchStart(element, "mousedown");
		expect(second.defaultPrevented).toBe(false);
		expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
	} finally {
		window.requestAnimationFrame = originalRAF;
	}
});

test("element processed twice does not register duplicate listeners", () => {
	const extension = setupExtension();
	const element = createElement("hold delay:120ms");

	extension.onEvent?.(HOLD_EVENT, createHoldEvent(element));
	dispatchStart(element, "mousedown");
	dispatchCancel(element, "mouseup");

	mockHtmx.addClass.mockReset();

	// Re-process the same element
	extension.onEvent?.(HOLD_EVENT, createHoldEvent(element));
	dispatchStart(element, "mousedown");

	expect(mockHtmx.addClass).toHaveBeenCalledTimes(1);
});

test("data-hx-trigger is used when hx-trigger is absent", () => {
	const extension = setupExtension();
	const element = createElement();
	element.setAttribute("data-hx-trigger", "hold delay:250ms");

	extension.onEvent?.(HOLD_EVENT, createHoldEvent(element));
	dispatchStart(element, "mousedown");

	expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
});

test("hold trigger is case sensitive", () => {
	const extension = setupExtension();
	const element = createElement("Hold delay:200ms");

	extension.onEvent?.(HOLD_EVENT, createHoldEvent(element));
	dispatchStart(element, "mousedown");

	expect(mockHtmx.addClass).not.toHaveBeenCalled();
});
