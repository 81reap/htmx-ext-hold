import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import registerHoldExtension from "../src/index";

let mockHtmx: any;
let originalHtmx: any;

// Helper functions
function createMockElement() {
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
}

function setupHoldExtension() {
	registerHoldExtension();
	return mockHtmx.definedExtensions.hold;
}

function createElementWithTrigger(trigger: string) {
	const element = createMockElement();
	element.setAttribute("hx-trigger", trigger);
	return element;
}

function simulateAfterProcessNode(extension: any, element: any) {
	extension.onEvent("htmx:afterProcessNode", { detail: { elt: element } });
}

function simulateMouseDown(element: any) {
	const event = { type: "mousedown", preventDefault: mock() };
	element.dispatchEvent(event);
	return event;
}

function simulateTouchStart(element: any) {
	const event = { type: "touchstart", preventDefault: mock() };
	element.dispatchEvent(event);
	return event;
}

beforeEach(() => {
	originalHtmx = (globalThis as any).htmx;
	mockHtmx = {
		defineExtension: mock((name: string, extension: any) => {
			mockHtmx.definedExtensions[name] = extension;
		}),
		trigger: mock(),
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
	expect((element as any)._holdSetup).toBe(true);

	const event = simulateMouseDown(element);
	expect(event.preventDefault).toHaveBeenCalled();
	expect(mockHtmx.trigger).toHaveBeenCalledWith(element, "hold");
});

test("triggers hold on mousedown for hold delay elements", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("hold delay:500ms");

	simulateAfterProcessNode(extension, element);
	simulateMouseDown(element);

	expect(mockHtmx.trigger).toHaveBeenCalledWith(element, "hold");
});

test("triggers hold on touchstart for hold delay elements", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("hold delay:300ms");

	simulateAfterProcessNode(extension, element);
	simulateTouchStart(element);

	expect(mockHtmx.trigger).toHaveBeenCalledWith(element, "hold");
});

test("ignores elements without hold trigger", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("click");

	simulateAfterProcessNode(extension, element);
	expect((element as any)._holdSetup).toBeUndefined();
});

test("ignores elements with hold but no delay", () => {
	const extension = setupHoldExtension();
	const element = createElementWithTrigger("hold");

	simulateAfterProcessNode(extension, element);
	expect((element as any)._holdSetup).toBeUndefined();
});

test("handles various delay formats in trigger spec", () => {
	const extension = setupHoldExtension();

	// Test different positions and formats
	const testCases = [
		"hold delay:1000ms",
		"hold delay:200ms, click",
		"click, hold delay:600ms",
		"hold delay:1000ms changed",
		"hold delay:invalidms",
	];

	testCases.forEach((trigger) => {
		const element = createElementWithTrigger(trigger);
		simulateAfterProcessNode(extension, element);
		simulateMouseDown(element);
		expect(mockHtmx.trigger).toHaveBeenCalledWith(element, "hold");
	});
});
