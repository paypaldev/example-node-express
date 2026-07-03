# PayPal Checkout Demo

A minimal **Express + TypeScript** app demonstrating a complete PayPal
Checkout flow using the official
[`@paypal/paypal-server-sdk`](https://www.npmjs.com/package/@paypal/paypal-server-sdk)
on the server and the
[PayPal JavaScript SDK v6](https://developer.paypal.com/sdk/js/) web components
on a plain HTML front-end.

It shows the full server-side pattern: **create an order**, let the buyer
approve it in the PayPal UI, then **capture** the payment — with prices held on
the server so they can't be tampered with from the browser.

## Setup

1. Create a sandbox app at
   [developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox)
   to get a **Client ID** and **Secret**.
2. Copy the env template and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   ```dotenv
   PAYPAL_CLIENT_ID=your_sandbox_client_id
   PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
   PAYPAL_ENV=sandbox   # or "live"
   PORT=3000
   ```
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```
4. Open <http://localhost:3000> and pay with a
   [sandbox test account](https://developer.paypal.com/dashboard/accounts) or a
   [generated test card](https://developer.paypal.com/tools/sandbox/card-testing/).

## How it works

The checkout is a three-legged handshake between the browser, this server, and
PayPal. The browser never talks to PayPal's REST API directly — it only ever
calls this server, which holds the secret and the prices.

```
Browser                      This server                    PayPal
  │  GET /api/config            │                              │
  │ ───────────────────────────▶│  clientId, env, sdkUrl       │
  │ ◀───────────────────────────│                              │
  │  (loads PayPal SDK, renders <paypal-button>)               │
  │                             │                              │
  │  click → POST /api/orders   │  createOrder(item)           │
  │ ───────────────────────────▶│ ────────────────────────────▶│
  │ ◀───────────────────────────│ ◀────────────────────────────│  order id
  │  (buyer approves in PayPal UI)                             │
  │                             │                              │
  │  POST /api/orders/:id/capture  captureOrder(order)         │
  │ ───────────────────────────▶│ ────────────────────────────▶│
  │ ◀───────────────────────────│ ◀────────────────────────────│  COMPLETED
```

### Files

| File | Responsibility |
| --- | --- |
| `src/server.ts` | The whole server: PayPal SDK client, endpoints, and the in-memory stores. |
| `public/index.html` | Loads the PayPal SDK v6, renders the `<paypal-button>` web component, and drives the checkout. |

Everything lives in `src/server.ts`:

- A `products` `Map` — the stub catalogue. Prices are held **server-side** so
  the browser can't change them.
- An `orders` `Map` — created orders and their capture responses, kept in
  memory (lost on restart).
- A PayPal `Client` from `@paypal/paypal-server-sdk`, driven through its
  `OrdersController`.

### Endpoints

- `GET /api/config` — hands the front-end the public `clientId`, `env`, and the
  correct `sdkUrl`. Loading the SDK URL from the server lets you switch between
  sandbox and live without touching client code.
- `POST /api/orders` — looks up the product by `itemId`, asks PayPal to create
  an order, and stores it. Returns the order id.
- `POST /api/orders/:orderId/capture` — captures the previously approved order
  and stores the capture response.

### Talking to PayPal

The [`@paypal/paypal-server-sdk`](https://www.npmjs.com/package/@paypal/paypal-server-sdk)
handles the REST calls and OAuth for you. A single `Client` is configured with
the client id/secret (client-credentials auth) and the environment, then
`OrdersController` exposes:

- `createOrder(...)` — creates an order with `intent: CAPTURE` and the product's
  amount pulled from the server-side `products` map.
- `captureOrder({ id })` — captures the previously approved order.

`PAYPAL_ENV` drives both the SDK's `Environment` (Sandbox vs Production) and the
front-end `sdkUrl` returned by `/api/config`, so switching between sandbox and
live is a single env change.

## Notes for a real application

This is a demo. Before using anything like it in production you'd want to:

- Replace the in-memory `products` and `orders` maps with a real database (the
  order store here is lost on restart).
- Compute order amounts from a real cart rather than a single hardcoded
  `demo-product` (currently `£9.99 GBP`).
- Add input validation, authentication, idempotency, and verification of
  PayPal [webhooks](https://developer.paypal.com/api/rest/webhooks/) for
  reliable payment confirmation.

## Production build

```bash
npm run build && npm start
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Run with `tsx watch` (auto-reload on changes). |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm start` | Run the app via `tsx`. |
