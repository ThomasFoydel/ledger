import type { Dispatch, SetStateAction } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../api";

type CartProductItem = {
  product: Product;
  quantity: number;
};

type CartItemsProps = {
  items: CartProductItem[];
  currency: Intl.NumberFormat;
  quantityDrafts: Record<string, string>;
  setQuantityDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onUpdateQuantity: (product: Product, quantity: number) => void;
};

export default function CartItems({
  items,
  currency,
  quantityDrafts,
  setQuantityDrafts,
  onUpdateQuantity,
}: CartItemsProps) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon" aria-hidden="true">◇</span>
        <h2>Your cart is empty</h2>
        <p>Find something worth keeping.</p>
        <Link className="button button-primary" to="/">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="cart-items">
      {items.map(({ product, quantity }) => (
        <article className="cart-item" key={product.id}>
          <div className="cart-item-art" aria-hidden="true">
            {product.name.trim().charAt(0).toLocaleUpperCase()}
          </div>
          <div className="cart-item-info">
            <Link
              className="product-title-link"
              to={`/products/${encodeURIComponent(product.id)}`}
            >
              {product.name}
            </Link>
            <p>{currency.format(product.price)} each</p>
            {product.quantityOnHand === 0 && (
              <p className="stock-unavailable">Currently out of stock</p>
            )}
            <button
              type="button"
              className="text-button text-button-danger"
              onClick={() => onUpdateQuantity(product, 0)}
            >
              Remove
            </button>
          </div>
          <div className="cart-item-quantity">
            <label htmlFor={`cart-quantity-${product.id}`}>Qty</label>
            <input
              id={`cart-quantity-${product.id}`}
              type="number"
              min={1}
              max={product.quantityOnHand}
              step={1}
              value={quantityDrafts[product.id] ?? String(quantity)}
              disabled={product.quantityOnHand === 0}
              onChange={(event) =>
                setQuantityDrafts((current) => ({
                  ...current,
                  [product.id]: event.target.value,
                }))
              }
              onBlur={(event) => {
                const value = Number(event.currentTarget.value);
                if (Number.isInteger(value) && value > 0) {
                  onUpdateQuantity(product, value);
                }
                setQuantityDrafts((current) => {
                  const next = { ...current };
                  delete next[product.id];
                  return next;
                });
              }}
            />
          </div>
          <strong className="cart-line-total">
            {currency.format(product.price * quantity)}
          </strong>
        </article>
      ))}
    </div>
  );
}
