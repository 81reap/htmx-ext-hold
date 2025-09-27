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

