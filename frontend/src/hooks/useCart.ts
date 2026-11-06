import { useEffect, useRef, useState } from "react";
import type { Product } from "../api";

export type CartItem = {
  productId: string;
  quantity: number;
};

const CART_STORAGE_KEY = "ledger-cart";

export default function useCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (!saved) return [];

      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      return parsed.filter(
        (item): item is CartItem =>
          typeof item?.productId === "string" &&
          Number.isInteger(item?.quantity) &&
          item.quantity > 0,
      );
    } catch {
      return [];
    }
  });

  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const cartDrawerRef = useRef<HTMLElement>(null);
  const cartTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (!cartDrawerOpen) return;

    const previousActiveElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    cartDrawerRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCartDrawerOpen(false);
        return;
      }

      if (event.key !== "Tab" || !cartDrawerRef.current) return;

      const focusable = Array.from(
        cartDrawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");

      if (focusable.length === 0) {
        event.preventDefault();
        cartDrawerRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [cartDrawerOpen]);

  function addToCart(
    product: Product,
    quantity = 1,
    onUnavailable?: () => void,
  ) {
    if (!product.isActive || product.quantityOnHand <= 0) {
      onUnavailable?.();
      return;
    }

    setCartItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      const nextQuantity = Math.min(
        product.quantityOnHand,
        (existing?.quantity ?? 0) + quantity,
      );

      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: nextQuantity }
            : item,
        );
      }

      return [...current, { productId: product.id, quantity: nextQuantity }];
    });

    setCartDrawerOpen(true);
  }

  function updateCartQuantity(product: Product, quantity: number) {
    if (quantity <= 0) {
      setCartItems((current) =>
        current.filter((item) => item.productId !== product.id),
      );
      return;
    }

    setCartItems((current) =>
      current.map((item) =>
        item.productId === product.id
          ? { ...item, quantity: Math.min(quantity, product.quantityOnHand) }
          : item,
      ),
    );
  }

  function getCartProductItems(products: Product[]) {
    return cartItems.flatMap((item) => {
      const product = products.find(
        (candidate) => candidate.id === item.productId,
      );
      return product ? [{ ...item, product }] : [];
    });
  }

  const cartItemCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  return {
    cartItems,
    setCartItems,
    cartDrawerOpen,
    setCartDrawerOpen,
    cartDrawerRef,
    cartTriggerRef,
    cartItemCount,
    addToCart,
    updateCartQuantity,
    getCartProductItems,
  };
}
