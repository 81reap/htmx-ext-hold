import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import registerHoldExtension from "../src/index"; // Adjust path if needed

// Mock htmx globally for tests
let mockHtmx: any;
let originalHtmx: any;
let mockTimeouts: any[] = [];
let originalSetTimeout: any;
let originalClearTimeout: any;

beforeEach(() => {
	originalHtmx = (globalThis as any).htmx;
	originalSetTimeout = globalThis.setTimeout;
	originalClearTimeout = globalThis.clearTimeout;
	mockTimeouts = [];
	mockHtmx = {
		defineExtension: mock((name: string, extension: any) => {
			mockHtmx.definedExtensions[name] = extension;
		}),
		trigger: mock((elt: HTMLElement, eventName: string) => {
			const event = new CustomEvent(eventName, { bubbles: true });
			elt.dispatchEvent(event);
		}),
		definedExtensions: {}, // To store registered extensions
	};
	(globalThis as any).htmx = mockHtmx;
	(globalThis as any).window = globalThis;
	(globalThis as any).setTimeout = mock((fn: Function, delay: number) => {
		const id = mockTimeouts.length;
		mockTimeouts.push({ fn, delay, id });
		return id;
	});
	(globalThis as any).clearTimeout = mock((id: number) => {
		if (mockTimeouts[id]) {
			mockTimeouts[id].cleared = true;
		}
	});
	// Mock document
	(globalThis as any).document = {
		addEventListener: mock(() => {}),
		createElement: () => {
			const listeners: { [key: string]: Function[] } = {};
			const attributes: { [key: string]: string } = {};
			return {
				addEventListener: (event: string, handler: Function) => {
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
						eventListeners.forEach((handler) => handler(event));
					}
				},
			};
		},
		body: {
			appendChild: mock(() => {}),
			innerHTML: "",
		},
	};
});

afterEach(() => {
	(globalThis as any).htmx = originalHtmx;
	globalThis.setTimeout = originalSetTimeout;
	globalThis.clearTimeout = originalClearTimeout;
	// Clean up any global listeners or elements created in tests
	(globalThis as any).document.body.innerHTML = "";
});

test('registerHoldExtension registers the "hold" extension', () => {
	registerHoldExtension();
	expect(mockHtmx.defineExtension).toHaveBeenCalledWith(
		"hold",
		expect.any(Object),
	);
	expect(mockHtmx.definedExtensions["hold"]).toBeDefined();
});

test('onEvent "htmx:afterProcessNode" correctly sets up event listeners for elements with hx-trigger="hold delay:..."', () => {
	registerHoldExtension();
	const holdExtension = mockHtmx.definedExtensions["hold"];

	const element = (globalThis as any).document.createElement("div");
	element.setAttribute("hx-trigger", "click, hold delay:500ms");
	(globalThis as any).document.body.appendChild(element);

	// Simulate htmx:afterProcessNode event
	const eventDetail = { elt: element };
	holdExtension.onEvent("htmx:afterProcessNode", { detail: eventDetail });

	// Check if _holdSetup is true
	expect((element as any)._holdSetup).toBeTrue();

	// Simulate mousedown and check if preventDefault is called and setTimeout is set
	const mousedownEvent = {
		type: "mousedown",
		preventDefault: mock(() => {}),
		defaultPrevented: false,
	} as any;
	element.dispatchEvent(mousedownEvent);

	expect(mousedownEvent.preventDefault).toHaveBeenCalled(); // startHold prevents default
	expect(mockTimeouts.length).toBe(1);
	expect(mockTimeouts[0].delay).toBe(500);

	// Simulate time passing and check if trigger is called
	mockTimeouts[0].fn();
	expect(mockHtmx.trigger).toHaveBeenCalledWith(element, "hold");
});

test("cancels hold on mouseup before delay", () => {
	registerHoldExtension();
	const holdExtension = mockHtmx.definedExtensions["hold"];

	const element = (globalThis as any).document.createElement("div");
	element.setAttribute("hx-trigger", "hold delay:500ms");
	(globalThis as any).document.body.appendChild(element);

	holdExtension.onEvent("htmx:afterProcessNode", { detail: { elt: element } });

	// Start hold
	const mousedownEvent = {
		type: "mousedown",
		preventDefault: mock(() => {}),
	} as any;
	element.dispatchEvent(mousedownEvent);
	expect(mockTimeouts.length).toBe(1);

	// Cancel with mouseup
	const mouseupEvent = { type: "mouseup" } as any;
	element.dispatchEvent(mouseupEvent);
	expect((globalThis as any).clearTimeout).toHaveBeenCalledWith(0);
	expect(mockHtmx.trigger).not.toHaveBeenCalled();
});

test("cancels hold on mouseleave before delay", () => {
	registerHoldExtension();
	const holdExtension = mockHtmx.definedExtensions["hold"];

	const element = (globalThis as any).document.createElement("div");
	element.setAttribute("hx-trigger", "hold");
	(globalThis as any).document.body.appendChild(element);

	holdExtension.onEvent("htmx:afterProcessNode", { detail: { elt: element } });

	// Start hold
	const mousedownEvent = {
		type: "mousedown",
		preventDefault: mock(() => {}),
	} as any;
	element.dispatchEvent(mousedownEvent);
	expect(mockTimeouts.length).toBe(1);

	// Cancel with mouseleave
	const mouseleaveEvent = { type: "mouseleave" } as any;
	element.dispatchEvent(mouseleaveEvent);
	expect((globalThis as any).clearTimeout).toHaveBeenCalledWith(0);
	expect(mockHtmx.trigger).not.toHaveBeenCalled();
});

test("parses different delay values", () => {
	registerHoldExtension();
	const holdExtension = mockHtmx.definedExtensions["hold"];

	const element1 = (globalThis as any).document.createElement("div");
	element1.setAttribute("hx-trigger", "hold delay:1000ms");
	(globalThis as any).document.body.appendChild(element1);
	holdExtension.onEvent("htmx:afterProcessNode", { detail: { elt: element1 } });

	const mousedownEvent1 = {
		type: "mousedown",
		preventDefault: mock(() => {}),
	} as any;
	element1.dispatchEvent(mousedownEvent1);
	expect(mockTimeouts[0].delay).toBe(1000);

	const element2 = (globalThis as any).document.createElement("div");
	element2.setAttribute("hx-trigger", "hold delay:200ms");
	(globalThis as any).document.body.appendChild(element2);
	holdExtension.onEvent("htmx:afterProcessNode", { detail: { elt: element2 } });

	const mousedownEvent2 = {
		type: "mousedown",
		preventDefault: mock(() => {}),
	} as any;
	element2.dispatchEvent(mousedownEvent2);
	expect(mockTimeouts[1].delay).toBe(200);
});

test("uses default delay of 500ms when no delay specified", () => {
	registerHoldExtension();
	const holdExtension = mockHtmx.definedExtensions["hold"];

	const element = (globalThis as any).document.createElement("div");
	element.setAttribute("hx-trigger", "hold");
	(globalThis as any).document.body.appendChild(element);

	holdExtension.onEvent("htmx:afterProcessNode", { detail: { elt: element } });

	const mousedownEvent = {
		type: "mousedown",
		preventDefault: mock(() => {}),
	} as any;
	element.dispatchEvent(mousedownEvent);
	expect(mockTimeouts[0].delay).toBe(500);
});

test("does not set up listeners for elements without hold trigger", () => {
	registerHoldExtension();
	const holdExtension = mockHtmx.definedExtensions["hold"];

	const element = (globalThis as any).document.createElement("div");
	element.setAttribute("hx-trigger", "click");
	(globalThis as any).document.body.appendChild(element);

	holdExtension.onEvent("htmx:afterProcessNode", { detail: { elt: element } });

	expect((element as any)._holdSetup).toBeUndefined();
});

test("handles touch events", () => {
	registerHoldExtension();
	const holdExtension = mockHtmx.definedExtensions["hold"];

	const element = (globalThis as any).document.createElement("div");
	element.setAttribute("hx-trigger", "hold delay:300ms");
	(globalThis as any).document.body.appendChild(element);

	holdExtension.onEvent("htmx:afterProcessNode", { detail: { elt: element } });

	// Start with touchstart
	const touchstartEvent = {
		type: "touchstart",
		preventDefault: mock(() => {}),
	} as any;
	element.dispatchEvent(touchstartEvent);
	expect(mockTimeouts.length).toBe(1);
	expect(mockTimeouts[0].delay).toBe(300);

	// Cancel with touchend
	const touchendEvent = { type: "touchend" } as any;
	element.dispatchEvent(touchendEvent);
	expect((globalThis as any).clearTimeout).toHaveBeenCalledWith(0);
});

test("handles invalid delay values by using default", () => {
	registerHoldExtension();
	const holdExtension = mockHtmx.definedExtensions["hold"];

	const element = (globalThis as any).document.createElement("div");
	element.setAttribute("hx-trigger", "hold delay:invalidms");
	(globalThis as any).document.body.appendChild(element);

	holdExtension.onEvent("htmx:afterProcessNode", { detail: { elt: element } });

	const mousedownEvent = {
		type: "mousedown",
		preventDefault: mock(() => {}),
	} as any;
	element.dispatchEvent(mousedownEvent);
	expect(mockTimeouts[0].delay).toBe(500); // default
});

test("parses delay correctly when hold is first in trigger spec", () => {
	registerHoldExtension();
	const holdExtension = mockHtmx.definedExtensions["hold"];

	const element = (globalThis as any).document.createElement("div");
	element.setAttribute("hx-trigger", "hold delay:750ms, click");
	(globalThis as any).document.body.appendChild(element);

	holdExtension.onEvent("htmx:afterProcessNode", { detail: { elt: element } });

	const mousedownEvent = {
		type: "mousedown",
		preventDefault: mock(() => {}),
	} as any;
	element.dispatchEvent(mousedownEvent);
	expect(mockTimeouts[0].delay).toBe(750);
});

test("parses delay correctly when hold is after other triggers", () => {
	registerHoldExtension();
	const holdExtension = mockHtmx.definedExtensions["hold"];

	const element = (globalThis as any).document.createElement("div");
	element.setAttribute("hx-trigger", "click, hold delay:600ms");
	(globalThis as any).document.body.appendChild(element);

	holdExtension.onEvent("htmx:afterProcessNode", { detail: { elt: element } });

	const mousedownEvent = {
		type: "mousedown",
		preventDefault: mock(() => {}),
	} as any;
	element.dispatchEvent(mousedownEvent);
	expect(mockTimeouts[0].delay).toBe(600);
});

test("parses delay correctly with modifiers after delay", () => {
	registerHoldExtension();
	const holdExtension = mockHtmx.definedExtensions["hold"];

	const element = (globalThis as any).document.createElement("div");
	element.setAttribute("hx-trigger", "hold delay:1000ms changed");
	(globalThis as any).document.body.appendChild(element);

	holdExtension.onEvent("htmx:afterProcessNode", { detail: { elt: element } });

	const mousedownEvent = {
		type: "mousedown",
		preventDefault: mock(() => {}),
	} as any;
	element.dispatchEvent(mousedownEvent);
	expect(mockTimeouts[0].delay).toBe(1000);
});
