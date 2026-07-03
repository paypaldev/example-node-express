import path from "node:path";
import express from "express";
import dotenv from "dotenv";
import { CheckoutPaymentIntent, Client, Environment, OrdersController } from '@paypal/paypal-server-sdk';
dotenv.config();

// Create a configuration object for PayPal settings, using environment variables for sensitive information.
const paypalSettings = {
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  env: process.env.PAYPAL_ENV as "sandbox" | "live"
};

// These are stub in-memory stores for demonstration purposes.
// In a real application, you would use a proper database to store products and orders.
// Prices are held server-side so they can't be tampered with from the browser.
type Item = { amount: { currencyCode: string; value: string }; description: string; };
const orders = new Map<string, { order: any; captureResponse?: any }>();
const products = new Map<string, Item>([
  ["demo-product", { amount: { currencyCode: "USD", value: "9.99" }, description: "Demo product" }],
]);

// Create a PayPal OrdersController instance to handle order creation and capture.
// This uses an instance of the PayPal Client, which is configured with client credentials 
// and environment settings.
const ordersController = new OrdersController(new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.PAYPAL_CLIENT_ID!,
    oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!
  },
  timeout: 0,
  environment: process.env.PAYPAL_ENV === "live" ? Environment.Production : Environment.Sandbox,
}));

// Create an Express application to handle API requests and serve static files.
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// API endpoint to get the PayPal client ID and environment for the front-end.
app.get("/api/config", (_req, res) => {
  res.json({
    clientId: paypalSettings.clientId,
    env: paypalSettings.env,
    sdkUrl: paypalSettings.env === "live"
      ? "https://www.paypal.com/web-sdk/v6/core"
      : "https://www.sandbox.paypal.com/web-sdk/v6/core"
  });
});

// API endpoint to create a new order with PayPal.
app.post("/api/orders", async (_req, res) => {
  try {
    const item = products.get(_req.body.itemId);
    const data = await ordersController.createOrder({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [item!],
      },
    });

    orders.set(data.result.id!, { order: data.result });

    res.status(200).json(data.result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// API endpoint to capture an existing order with PayPal.
app.post("/api/orders/:orderId/capture", async (req, res) => {
  try {
    const { orderId } = req.params;
    const record = orders.get(orderId)!;

    const data = await ordersController.captureOrder({ id: record.order.id! });
    record.captureResponse = data.result;

    res.status(200).json(data.result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to capture order" });
  }
});

app.listen(Number(process.env.PORT), () => {
  console.log(`Server running on http://localhost:${process.env.PORT} (${paypalSettings.env})`);
});
