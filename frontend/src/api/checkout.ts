import { API_PREFIX } from "./client";
import type { CheckoutItem, ShippingDestination } from "./shipping";

export type CheckoutSession = {
  sessionId: string;
  url: string;
};

export type CheckoutStatus = {
  orderId: string;
  status: string;
};

export async function createCheckoutSession(
  items: CheckoutItem[],
  destination: ShippingDestination,
  shippingServiceToken: string,
  shippingRateIds: string[],
): Promise<CheckoutSession> {
  const response = await fetch(`${API_PREFIX}/checkout/sessions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items,
      destination,
      shippingServiceToken,
      shippingRateIds,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail ??
        data?.error ??
        data?.title ??
        "Could not start checkout. Please try again.",
    );
  }

  if (typeof data?.sessionId !== "string" || typeof data?.url !== "string") {
    throw new Error("The checkout service returned an invalid response.");
  }

  return data as CheckoutSession;
}

export async function getCheckoutSession(
  sessionId: string,
): Promise<CheckoutStatus> {
  const response = await fetch(
    `${API_PREFIX}/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { credentials: "include" },
  );

  if (response.status === 404) {
    throw new Error("The checkout session could not be found.");
  }
  if (!response.ok) {
    throw new Error("Could not check payment status.");
  }

  return response.json() as Promise<CheckoutStatus>;
}
