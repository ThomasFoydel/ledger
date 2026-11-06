import type { FormEventHandler } from "react";
import { Link } from "react-router-dom";
import type { Product, ShippingDestination, ShippingRate } from "../api";

type CartProductItem = {
  product: Product;
  quantity: number;
};

type CheckoutSummaryProps = {
  items: CartProductItem[];
  destination: ShippingDestination;
  setDestination: (
    updater: (current: ShippingDestination) => ShippingDestination,
  ) => void;
  shippingRates: ShippingRate[] | null;
  selectedShippingServiceToken: string;
  setSelectedShippingServiceToken: (token: string) => void;
  shippingLoading: boolean;
  shippingError: string;
  submitting: boolean;
  error: string;
  subtotal: number;
  currency: Intl.NumberFormat;
  onGetShippingRates: FormEventHandler<HTMLFormElement>;
  onCheckout: () => void;
};

export default function CheckoutSummary({
  items,
  destination,
  setDestination,
  shippingRates,
  selectedShippingServiceToken,
  setSelectedShippingServiceToken,
  shippingLoading,
  shippingError,
  submitting,
  error,
  subtotal,
  currency,
  onGetShippingRates,
  onCheckout,
}: CheckoutSummaryProps) {
  const selectedRate = shippingRates?.find(
    (rate) => rate.serviceToken === selectedShippingServiceToken,
  );

  const hasUnavailableItems = items.some(
    ({ product, quantity }) =>
      product.price <= 0 || product.quantityOnHand < quantity,
  );

  return (
    <aside className="cart-summary">
      <h2>Shipping address</h2>

      <form className="shipping-form" onSubmit={onGetShippingRates}>
        <div className="field">
          <label htmlFor="shipping-name">Full name</label>
          <input
            id="shipping-name"
            autoComplete="name"
            required
            maxLength={100}
            value={destination.name}
            onChange={(event) =>
              setDestination((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
        </div>

        <div className="field">
          <label htmlFor="shipping-street1">Street address</label>
          <input
            id="shipping-street1"
            autoComplete="address-line1"
            required
            maxLength={200}
            value={destination.street1}
            onChange={(event) =>
              setDestination((current) => ({
                ...current,
                street1: event.target.value,
              }))
            }
          />
        </div>

        <div className="field">
          <label htmlFor="shipping-street2">
            Apartment, suite, etc. (optional)
          </label>
          <input
            id="shipping-street2"
            autoComplete="address-line2"
            maxLength={200}
            value={destination.street2}
            onChange={(event) =>
              setDestination((current) => ({
                ...current,
                street2: event.target.value,
              }))
            }
          />
        </div>

        <div className="field">
          <label htmlFor="shipping-city">City</label>
          <input
            id="shipping-city"
            autoComplete="address-level2"
            required
            maxLength={100}
            value={destination.city}
            onChange={(event) =>
              setDestination((current) => ({
                ...current,
                city: event.target.value,
              }))
            }
          />
        </div>

        <div className="shipping-form-row">
          <div className="field">
            <label htmlFor="shipping-state">State</label>
            <input
              id="shipping-state"
              autoComplete="address-level1"
              required
              maxLength={2}
              minLength={2}
              placeholder="IL"
              value={destination.state}
              onChange={(event) =>
                setDestination((current) => ({
                  ...current,
                  state: event.target.value.toUpperCase(),
                }))
              }
            />
          </div>

          <div className="field">
            <label htmlFor="shipping-postal-code">ZIP code</label>
            <input
              id="shipping-postal-code"
              autoComplete="postal-code"
              required
              maxLength={10}
              value={destination.postalCode}
              onChange={(event) =>
                setDestination((current) => ({
                  ...current,
                  postalCode: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <p className="muted">
          Shipping is currently available within the United States.
        </p>

        <button
          type="submit"
          className="button button-secondary cart-checkout-button"
          disabled={shippingLoading || submitting || items.length === 0 || hasUnavailableItems}
        >
          {shippingLoading ? "Getting rates…" : "Get shipping rates"}
        </button>
      </form>

      {shippingError && (
        <p className="error-message" role="alert">{shippingError}</p>
      )}

      {shippingRates && shippingRates.length > 0 && (
        <div className="shipping-rate-list">
          <h3>Choose a shipping method</h3>
          {shippingRates.map((rate) => (
            <label className="shipping-rate-option" key={rate.serviceToken}>
              <input
                type="radio"
                name="shipping-rate"
                value={rate.serviceToken}
                checked={selectedShippingServiceToken === rate.serviceToken}
                onChange={() =>
                  setSelectedShippingServiceToken(rate.serviceToken)
                }
              />
              <span>
                <strong>{rate.serviceName}</strong>
                <small>
                  {rate.provider} · {rate.parcelCount} parcel
                  {rate.parcelCount === 1 ? "" : "s"}
                </small>
              </span>
              <strong>{currency.format(rate.amount)}</strong>
            </label>
          ))}
        </div>
      )}

      <h2 className="order-summary-heading">Order summary</h2>
      <div className="cart-summary-row">
        <span>Subtotal</span>
        <strong>{currency.format(subtotal)}</strong>
      </div>
      <div className="cart-summary-row">
        <span>Shipping</span>
        <strong>{selectedRate ? currency.format(selectedRate.amount) : "—"}</strong>
      </div>
      <div className="cart-summary-row cart-total-row">
        <span>Total</span>
        <strong>
          {currency.format(subtotal + (selectedRate?.amount ?? 0))}
        </strong>
      </div>
      <p className="muted">
        Taxes, if applicable, are calculated separately.
      </p>

      <button
        type="button"
        className="button button-primary cart-checkout-button"
        disabled={
          submitting ||
          !selectedShippingServiceToken ||
          items.length === 0 ||
          hasUnavailableItems
        }
        onClick={onCheckout}
      >
        {submitting ? "Redirecting…" : "Secure checkout"}
      </button>
      {error && <p className="error-message" role="alert">{error}</p>}
      <Link className="continue-shopping-link" to="/">
        Continue shopping
      </Link>
    </aside>
  );
}
