import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { getCheckoutSession } from "../api";

type CartItem = {
  productId: string;
  quantity: number;
};

type CheckoutResult = {
  sessionId: string;
  orderId?: string;
  status?: string;
  error?: string;
};

type UseCheckoutStatusOptions = {
  isCheckoutSuccessRoute: boolean;
  checkoutSessionId: string | null;
  setCartItems: Dispatch<SetStateAction<CartItem[]>>;
};

export function useCheckoutStatus({
  isCheckoutSuccessRoute,
  checkoutSessionId,
  setCartItems,
}: UseCheckoutStatusOptions) {
  const [checkoutResult, setCheckoutResult] =
    useState<CheckoutResult | null>(null);

  const checkoutStatus =
    checkoutResult?.sessionId === checkoutSessionId
      ? checkoutResult.status ?? null
      : null;
  const checkoutStatusError =
    checkoutResult?.sessionId === checkoutSessionId
      ? checkoutResult.error ?? ""
      : "";

  useEffect(() => {
    if (!isCheckoutSuccessRoute || !checkoutSessionId) return;

    const sessionId = checkoutSessionId;

    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const maxAttempts = 20;
    const pollIntervalMs = 1500;

    async function checkStatus() {
      try {
        const result = await getCheckoutSession(sessionId);
        if (!active) return;

        setCheckoutResult({
          sessionId,
          orderId: result.orderId,
          status: result.status,
        });

        if (result.status === "Paid") {
          setCartItems([]);
        }

        if (result.status === "Pending" && attempts < maxAttempts) {
          attempts += 1;
          timeoutId = setTimeout(() => {
            void checkStatus();
          }, pollIntervalMs);
        }
      } catch (err: unknown) {
        if (!active) return;

        setCheckoutResult({
          sessionId,
          error:
            err instanceof Error
              ? err.message
              : "Could not check payment status.",
        });
      }
    }

    void checkStatus();

    return () => {
      active = false;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [isCheckoutSuccessRoute, checkoutSessionId, setCartItems]);

  return {
    checkoutResult,
    checkoutStatus,
    checkoutStatusError,
  };
}
