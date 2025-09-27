import type htmx from "htmx.org";

declare global {
	interface Window {
		htmx: typeof htmx;
	}

	interface HTMLElement {
		_holdSetup?: boolean;
		"htmx-internal-data"?: {
			delayed?: number | null;
			holdInterval?: ReturnType<typeof setInterval> | null;
			holdAnimationId?: number | null;
		};
	}
}
