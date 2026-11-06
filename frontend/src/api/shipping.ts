import { API_PREFIX } from "./client";

export type CheckoutItem = {
  productId: string;
  quantity: number;
};

export type ShippingDestination = {
  name: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  country: "US";
};

export type ShippingRate = {
  serviceToken: string;
  serviceName: string;
  provider: string;
  amount: number;
  currency: string;
  rateIds: string[];
  parcelCount: number;
};

export type ShippingRatesResponse = {
  totalBars: number;
  parcelCount: number;
  rates: ShippingRate[];
};

export async function getShippingRates(
  items: CheckoutItem[],
  destination: ShippingDestination,
): Promise<ShippingRatesResponse> {
  const response = await fetch(`${API_PREFIX}/shipping/rates`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, destination }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail ??
        data?.error ??
        data?.title ??
        "Could not retrieve shipping rates. Please try again.",
    );
  }

  if (!Array.isArray(data?.rates)) {
    throw new Error("The shipping service returned an invalid response.");
  }

  return data as ShippingRatesResponse;
}
