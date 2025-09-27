import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type htmx from "htmx.org";
import type { HtmxExtension } from "htmx.org";
import registerHoldExtension from "../src/index";

type MockHtmx = Partial<typeof htmx> & {
	defineExtension: ReturnType<typeof mock>;
	trigger: ReturnType<typeof mock>;
	definedExtensions: Record<string, Partial<HtmxExtension>>;
};

type MockElement = {
	addEventListener: (event: string, handler: (event: Event) => void) => void;
	setAttribute: (name: string, value: string) => void;
	getAttribute: (name: string) => string | null;
	dispatchEvent: (event: Event) => void;
	style: { setProperty: (prop: string, value: string) => void };
	_holdSetup?: boolean;
};

let mockHtmx: MockHtmx;
let originalHtmx: typeof htmx | undefined;

// Helper functions
function createMockElement(): MockElement {
	const listeners: { [key: string]: ((event: Event) => void)[] } = {};
	const attributes: { [key: string]: string } = {};
	const styleProperties: { [key: string]: string } = {};
	return {
		addEventListener: (event: string, handler: (event: Event) => void) => {
			if (!listeners[event]) listeners[event] = [];
			listeners[event].push(handler);
		},
		setAttribute: (name: string, value: string) => {
			attributes[name] = value;
		},
		getAttribute: (name: string) => attributes[name] || null,
		dispatchEvent: (event: Event) => {
			const eventListeners = listeners[event.type];
			if (eventListeners) {
				eventListeners.forEach((handler) => {
					handler(event);
				});
			}
		},
		style: {
			setProperty: (prop: string, value: string) => {
				styleProperties[prop] = value;
			},
		},
	};
}

function setupHoldExtension() {
	registerHoldExtension();
	return mockHtmx.definedExtensions.hold as Partial<HtmxExtension>;
}

function createElementWithTrigger(trigger: string) {
	const element = createMockElement();
	element.setAttribute("hx-trigger", trigger);
	return element;
}

function simulateAfterProcessNode(
	extension: Partial<HtmxExtension>,
	element: MockElement,
) {
	const event = new CustomEvent("htmx:afterProcessNode", {
		detail: { elt: element },
	});
	extension.onEvent?.("htmx:afterProcessNode", event);
}

function simulateMouseDown(element: MockElement) {
	const event = new Event("mousedown");
	event.preventDefault = mock();
	element.dispatchEvent(event);
	return event;
}

function simulateTouchStart(element: MockElement) {
	const event = new Event("touchstart");
	event.preventDefault = mock();
	element.dispatchEvent(event);
	return event;
}

beforeEach(() => {
	originalHtmx = (globalThis as any).htmx;
	mockHtmx = {
		defineExtension: mock((name: string, extension: Partial<HtmxExtension>) => {
			mockHtmx.definedExtensions[name] = extension;
		}),
		trigger: mock(),
		parseInterval: mock((str: string) => {
			const match = str.match(/^(\d+)(ms|s)?$/);
			if (match && match[1]) {
				const num = parseInt(match[1], 10);
				return match[2] === "s" ? num * 1000 : num;
			}
			return undefined;
		}),
		addClass: mock(),
		removeClass: mock(),
		definedExtensions: {},
	};
	(globalThis as any).htmx = mockHtmx;

	(globalThis as any).document = {
		createElement: () => createMockElement(),
	};
});

afterEach(() => {
	(globalThis as any).htmx = originalHtmx;
});

test("registers hold extension", () => {
	registerHoldExtension();
	expect(mockHtmx.defineExtension).toHaveBeenCalledWith(
		"hold",
		expect.any(Object),
	);
	expect(mockHtmx.definedExtensions.hold).toBeDefined();
});

test("sets up listeners for elements with hold delay trigger", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("click, hold delay:500ms");

	simulateAfterProcessNode(extension, element);
	expect(element._holdSetup).toBe(true);

	const event = simulateMouseDown(element);
	expect(event.preventDefault).toHaveBeenCalled();
	expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
});

test("starts hold progress on mousedown for hold delay elements", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("hold delay:500ms");

	simulateAfterProcessNode(extension, element);
	simulateMouseDown(element);

	expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
});

test("starts hold progress on touchstart for hold delay elements", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("hold delay:300ms");

	simulateAfterProcessNode(extension, element);
	simulateTouchStart(element);

	expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
});

test("ignores elements without hold trigger", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("click");

	simulateAfterProcessNode(extension, element);
	expect(element._holdSetup).toBeUndefined();
});

test("handles various delay formats in trigger spec", () => {
	const extension = setupHoldExtension();

	// Test different positions and formats
	const testCases = [
		"hold delay:1000ms",
		"hold delay:200ms, click",
		"click, hold delay:600ms",
		"hold delay:1000ms changed",
	];

	testCases.forEach((trigger) => {
		const element = createElementWithTrigger(trigger);
		simulateAfterProcessNode(extension, element);
		simulateMouseDown(element);
		expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
	});
});

test("uses default 500ms delay when hold trigger has no delay specified", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("hold");

	simulateAfterProcessNode(extension, element);
	simulateMouseDown(element);

	expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
});

test("uses data-hx-trigger when hx-trigger is not present", () => {
	const extension = setupHoldExtension();
	const element = createMockElement();
	element.setAttribute("data-hx-trigger", "hold delay:500ms");

	simulateAfterProcessNode(extension, element);
	simulateMouseDown(element);

	expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
});

test("prefers hx-trigger over data-hx-trigger", () => {
	const extension = setupHoldExtension();
	const element = createMockElement();
	element.setAttribute("hx-trigger", "hold delay:500ms");
	element.setAttribute("data-hx-trigger", "click"); // This should be ignored

	simulateAfterProcessNode(extension, element);
	simulateMouseDown(element);

	expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
});

test("skips elements already processed", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("hold delay:500ms");

	// First processing
	simulateAfterProcessNode(extension, element);
	expect(element._holdSetup).toBe(true);

	// Reset mock to check if trigger is called again
	mockHtmx.trigger = mock();

	// Second processing should be skipped
	simulateAfterProcessNode(extension, element);
	simulateMouseDown(element);

	// Should still work (listeners were already set up)
	expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
});

test("handles touchcancel events", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("hold delay:500ms");

	simulateAfterProcessNode(extension, element);

	// Touch start
	simulateTouchStart(element);
	expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");

	// Touch cancel - should not cause errors
	element.dispatchEvent(new Event("touchcancel"));
});

test("ignores elements with no trigger attributes", () => {
	const extension = setupHoldExtension();
	const element = createMockElement();

	simulateAfterProcessNode(extension, element);

	expect(element._holdSetup).toBeUndefined();
});

test("is case sensitive for 'hold' keyword", () => {
	const extension = setupHoldExtension();

	// Test with uppercase 'Hold' - should not match
	const element = createElementWithTrigger("Hold delay:500ms");
	simulateAfterProcessNode(extension, element);

	expect(element._holdSetup).toBeUndefined();
});

test("handles multiple delay specifications", () => {
	const extension = setupHoldExtension();

	// Multiple delays - should still work as long as "hold" and "delay" are present
	const element = createElementWithTrigger("hold delay:100ms delay:200ms");
	simulateAfterProcessNode(extension, element);
	simulateMouseDown(element);

	expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
});

test("handles complex trigger specifications", () => {
	const extension = setupHoldExtension();

	const complexTriggers = [
		"click, hold delay:500ms, mouseover",
		"hold delay:1000ms changed, submit",
		"keydown[key=='Enter'], hold delay:300ms",
	];

	complexTriggers.forEach((trigger) => {
		const element = createElementWithTrigger(trigger);
		simulateAfterProcessNode(extension, element);
		simulateMouseDown(element);
		expect(mockHtmx.addClass).toHaveBeenCalledWith(element, "htmx-hold-active");
	});
});

test("preventDefault is called on hold events", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("hold delay:500ms");

	simulateAfterProcessNode(extension, element);

	const mouseEvent = simulateMouseDown(element);
	expect(mouseEvent.preventDefault).toHaveBeenCalled();

	const touchEvent = simulateTouchStart(element);
	expect(touchEvent.preventDefault).toHaveBeenCalled();
});

test("multiple elements are processed independently", () => {
	const extension = setupHoldExtension();

	const element1 = createElementWithTrigger("hold delay:500ms");
	const element2 = createElementWithTrigger("click"); // No hold
	const element3 = createElementWithTrigger("hold delay:1000ms");

	simulateAfterProcessNode(extension, element1);
	simulateAfterProcessNode(extension, element2);
	simulateAfterProcessNode(extension, element3);

	expect(element1._holdSetup).toBe(true);
	expect(element2._holdSetup).toBeUndefined();
	expect(element3._holdSetup).toBe(true);

	// Test that each works independently
	simulateMouseDown(element1);
	expect(mockHtmx.addClass).toHaveBeenCalledWith(element1, "htmx-hold-active");

	simulateMouseDown(element3);
	expect(mockHtmx.addClass).toHaveBeenCalledWith(element3, "htmx-hold-active");
});

test("non-matching events don't trigger hold", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("hold delay:500ms");

	simulateAfterProcessNode(extension, element);

	// Test various non-matching events
	const events = ["click", "mouseover", "keydown", "scroll"];

	events.forEach((eventType) => {
		element.dispatchEvent(new Event(eventType));
	});

	// Hold should not have been triggered
	expect(mockHtmx.trigger).not.toHaveBeenCalled();
});
