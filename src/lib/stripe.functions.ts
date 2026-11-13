import { createServerFn } from "@tanstack/react-start";

export const getStripePublishableKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.STRIPE_PUBLISHABLE_KEY ?? "" };
});

export const createBookingSetupIntent = createServerFn({ method: "POST" }).handler(async () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe not configured.");
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(key);
  const intent = await stripe.setupIntents.create({
    payment_method_types: ["card"],
    usage: "off_session",
  });
  return { client_secret: intent.client_secret!, id: intent.id };
});
