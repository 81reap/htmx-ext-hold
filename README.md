# htmx-ext-hold

An htmx extension to trigger events on 'hold' (mousedown/touchstart for a duration).

## Usage

Enable the extension on your page:

```html
<body hx-ext="hold">
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

