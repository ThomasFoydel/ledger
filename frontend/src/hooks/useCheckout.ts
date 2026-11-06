import { useState } from "react";
import type { Dispatch, FormEventHandler, SetStateAction } from "react";
import { useCheckoutStatus } from "./useCheckoutStatus";
import {
  createCheckoutSession,
  getShippingRates,
  type Product,
  type ShippingDestination,
  type ShippingRate,
} from "../api";

export type CartItem = {
  productId: string;
  quantity: number;
};

type CartProductItem = {
  product: Product;
  quantity: number;
};

type UseCheckoutOptions = {
  isCheckoutSuccessRoute: boolean;
  checkoutSessionId: string | null;
  items: CartProductItem[];
  setCartItems: Dispatch<SetStateAction<CartItem[]>>;
  setError: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
};

export function useCheckout({
  isCheckoutSuccessRoute,
  checkoutSessionId,
  items,
  setCartItems,
  setError,
  setSubmitting,
}: UseCheckoutOptions) {
  const [shippingDestination, setShippingDestination] =
    useState<ShippingDestination>({
      name: "",
      street1: "",
      street2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "US",
    });
  const {
    checkoutResult,
    checkoutStatus,
    checkoutStatusError,
  } = useCheckoutStatus({
    isCheckoutSuccessRoute,
    checkoutSessionId,
    setCartItems,
  });

  const [shippingRates, setShippingRates] =
    useState<ShippingRate[] | null>(null);
  const [selectedShippingServiceToken, setSelectedShippingServiceToken] =
    useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  function resetShippingSelection() {
    setShippingRates(null);
    setSelectedShippingServiceToken("");
    setShippingError("");
  }

  const handleGetShippingRates: FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    setShippingError("");
    setShippingRates(null);
    setSelectedShippingServiceToken("");
    setShippingLoading(true);

    try {
      const result = await getShippingRates(
        items.map(({ product, quantity }) => ({
          productId: product.id,
          quantity,
        })),
        shippingDestination,
      );

      setShippingRates(result.rates);
      if (result.rates.length === 0) {
        setShippingError(
          "No USPS Ground Advantage or Priority Mail rates were found for this address.",
        );
      }
    } catch (err) {
      setShippingError(
        err instanceof Error ? err.message : "Unable to retrieve shipping rates.",
      );
    } finally {
      setShippingLoading(false);
    }
  };

  async function handleCheckout() {
    const selectedRate = shippingRates?.find(
      (rate) => rate.serviceToken === selectedShippingServiceToken,
    );

    if (!selectedRate) {
      setShippingError("Please retrieve and select a shipping rate first.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const session = await createCheckoutSession(
        items.map(({ product, quantity }) => ({
          productId: product.id,
          quantity,
        })),
        shippingDestination,
        selectedRate.serviceToken,
        selectedRate.rateIds,
      );

      window.location.assign(session.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setSubmitting(false);
    }
  }



  return {
    shippingDestination,
    setShippingDestination,
    shippingRates,
    selectedShippingServiceToken,
    setSelectedShippingServiceToken,
    shippingLoading,
    shippingError,
    checkoutResult,
    checkoutStatus,
    checkoutStatusError,
    resetShippingSelection,
    handleGetShippingRates,
    handleCheckout,
  };
}
