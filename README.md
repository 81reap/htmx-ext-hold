# htmx-ext-hold

An htmx extension to trigger events on 'hold' (mousedown/touchstart for a duration).

## Installation

### Via CDN

Add the script tag after HTMX:

```html
<script src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.7"></script>
<script type="module" src="https://cdn.jsdelivr.net/npm/htmx-ext-hold@latest/dist/index.mjs"></script>
```

### Via NPM

```bash
npm install htmx-ext-hold
```

Then import in your JavaScript:

```javascript
import 'htmx-ext-hold';
```

## Usage

Enable the extension on your page:

```html
<body hx-ext="hold">
  <button hx-trigger="hold" hx-post="/action">Hold me for 500ms (default)</button>
  <button hx-trigger="hold delay:1000ms" hx-post="/action">Hold me for 1 second</button>
</body>
```

The `hold` trigger will fire after the specified delay (default 500ms) when the element is pressed and held.

### Visual feedback hooks

While the hold is active the extension exposes two progress indicators you can opt into:

- A CSS custom property `--hold-progress` scoped to the element. It moves from `0` to `1` during the hold, so you can drive fills, animations, or transforms directly from CSS.
- A `data-hold-progress` attribute with the same value expressed as an integer percentage (`0`–`100`), handy for text labels or aria-live updates without extra JavaScript.

```html
<button
  hx-trigger="hold delay:750ms"
  hx-post="/action"
  class="hold-button"
>
  Hold 750ms
</button>

<style>
  .hold-button {
    position: relative;
    overflow: hidden;
  }

  .hold-button::before {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(67, 170, 139, 0.4);
    transform-origin: left;
    transform: scaleX(var(--hold-progress));
    pointer-events: none;
  }
</style>
```

## Development

```bash
bun install

bun run build

bun test
```

## Publish

```bash
npm login

bun run prepublishOnly

npm publish
```
