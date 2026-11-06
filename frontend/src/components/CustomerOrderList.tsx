import { Link } from "react-router-dom";
import type { CustomerOrder } from "../api";

type CustomerOrderListProps = {
  orders: CustomerOrder[];
  loading: boolean;
  error: string;
  onRefresh: () => void | Promise<void>;
};

export default function CustomerOrderList({
  orders,
  loading,
  error,
  onRefresh,
}: CustomerOrderListProps) {
  return (
    <section className="cart-section orders-section">
      <div className="cart-heading">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>Your orders</h1>
        <p className="muted">Review your order history and payment status.</p>
      </div>

      {loading ? (
        <div className="empty-state" role="status">
          <p>Loading your orders…</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <p className="error-message" role="alert">{error}</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void onRefresh()}
          >
            Try again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">◇</span>
          <h2>No orders yet</h2>
          <p>Your completed purchases will appear here.</p>
          <Link className="button button-primary" to="/">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <article className="order-card" key={order.id}>
              <div className="order-card-heading">
                <div>
                  <p className="eyebrow">ORDER PLACED</p>
                  <p>{new Date(order.createdAtUtc).toLocaleString()}</p>
                </div>
                <div className="order-total">
                  <span className="muted">Order total</span>
                  <strong>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: order.currency.toUpperCase(),
                    }).format(order.totalAmount)}
                  </strong>
                </div>
              </div>
              <p>
                Status:{" "}
                <span className={`order-status order-status-${(order.fulfillmentStatus === "Shipped" ? "shipped" : order.fulfillmentStatus === "PartiallyShipped" ? "partially-shipped" : order.status).toLowerCase()}`}>
                  {order.fulfillmentStatus === "Shipped"
                    ? "Shipped"
                    : order.fulfillmentStatus === "PartiallyShipped"
                      ? "Partially shipped"
                      : order.status}
                </span>
              </p>
              {order.shipments.length > 0 && (
                <div className="customer-shipment-list">
                  {order.shipments.map(shipment => (
                    <div key={shipment.id} className="customer-shipment">
                      <strong>Parcel {shipment.parcelNumber}</strong>
                      <span className="muted">
                        {shipment.status}
                        {shipment.carrier ? ` · ${shipment.carrier}` : ""}
                      </span>
                      {shipment.trackingNumber && (
                        <p>
                          USPS tracking number:{" "}
                          <a
                            href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(shipment.trackingNumber)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {shipment.trackingNumber}
                          </a>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <ul className="order-items">
                {order.items.map((item, index) => (
                  <li key={`${order.id}-${item.productId}-${index}`}>
                    <span>
                      {item.productName} × {item.quantity}
                    </span>
                    <strong>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: order.currency.toUpperCase(),
                      }).format(item.unitPrice * item.quantity)}
                    </strong>
                  </li>
                ))}
              </ul>
              {order.paidAtUtc && (
                <p className="muted order-paid-date">
                  Paid {new Date(order.paidAtUtc).toLocaleString()}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
