import type { Dispatch, RefObject, SetStateAction } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../api";

type CartProductItem = {
  product: Product;
  quantity: number;
};

type CartDrawerProps = {
  drawerRef: RefObject<HTMLElement | null>;
  cartItemCount: number;
  cartProductItems: CartProductItem[];
  cartSubtotal: number;
  currency: Intl.NumberFormat;
  cartQuantityDrafts: Record<string, string>;
  setCartQuantityDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onClose: () => void;
  onUpdateQuantity: (product: Product, quantity: number) => void;
};

export default function CartDrawer({
  drawerRef,
  cartItemCount,
  cartProductItems,
  cartSubtotal,
  currency,
  cartQuantityDrafts,
  setCartQuantityDrafts,
  onClose,
  onUpdateQuantity,
}: CartDrawerProps) {
  return (
    <div className="cart-drawer-overlay">
      <button
        type="button"
        className="cart-drawer-backdrop"
        aria-label="Close shopping cart"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        tabIndex={-1}
      >
        <div className="cart-drawer-header">
          <div>
            <p className="eyebrow">YOUR SELECTION</p>
            <h2 id="cart-drawer-title">
              Your cart <span>({cartItemCount})</span>
            </h2>
          </div>
          <button
            type="button"
            className="cart-drawer-close"
            aria-label="Close shopping cart"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {cartProductItems.length === 0 ? (
          <div className="cart-drawer-empty">
            <span aria-hidden="true">◇</span>
            <h3>Your cart is empty</h3>
            <p>Find something worth keeping.</p>
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
            >
              Continue shopping
            </button>
          </div>
        ) : (
          <>
            <div className="cart-drawer-items">
              {cartProductItems.map(({ product, quantity }) => (
                <article className="cart-drawer-item" key={product.id}>
                  <div className="cart-drawer-item-art" aria-hidden="true">
                    {product.name.trim().charAt(0).toLocaleUpperCase()}
                  </div>
                  <div className="cart-drawer-item-info">
                    <Link
                      to={`/products/${encodeURIComponent(product.id)}`}
                      onClick={onClose}
                    >
                      {product.name}
                    </Link>
                    <p>{currency.format(product.price)} each</p>
                    <div className="cart-drawer-item-controls">
                      <label
                        className="visually-hidden"
                        htmlFor={`drawer-quantity-${product.id}`}
                      >
                        Quantity of {product.name}
                      </label>
                      <input
                        id={`drawer-quantity-${product.id}`}
                        type="number"
                        min={1}
                        max={product.quantityOnHand}
                        step={1}
                        value={cartQuantityDrafts[product.id] ?? String(quantity)}
                        disabled={product.quantityOnHand === 0}
                        onChange={(event) =>
                          setCartQuantityDrafts((current) => ({
                            ...current,
                            [product.id]: event.target.value,
                          }))
                        }
                        onBlur={(event) => {
                          const value = Number(event.currentTarget.value);
                          if (Number.isInteger(value) && value > 0) {
                            onUpdateQuantity(product, value);
                          }
                          setCartQuantityDrafts((current) => {
                            const next = { ...current };
                            delete next[product.id];
                            return next;
                          });
                        }}
                      />
                      <button
                        type="button"
                        className="text-button text-button-danger"
                        onClick={() => onUpdateQuantity(product, 0)}
                      >
                        Remove
                      </button>
                    </div>
                    {product.quantityOnHand === 0 && (
                      <p className="stock-unavailable">
                        Currently out of stock
                      </p>
                    )}
                  </div>
                  <strong className="cart-drawer-line-total">
                    {currency.format(product.price * quantity)}
                  </strong>
                </article>
              ))}
            </div>

            <div className="cart-drawer-footer">
              <div className="cart-drawer-subtotal">
                <span>Subtotal</span>
                <strong>{currency.format(cartSubtotal)}</strong>
              </div>
              <p>Shipping and taxes calculated at checkout.</p>
              <Link
                className="button button-primary cart-drawer-checkout"
                to="/cart"
                onClick={onClose}
              >
                View cart &amp; checkout
              </Link>
              <button
                type="button"
                className="cart-drawer-continue"
                onClick={onClose}
              >
                Continue shopping
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
