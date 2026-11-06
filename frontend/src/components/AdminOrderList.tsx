import type { Dispatch, SetStateAction } from "react";
import type { AdminOrder } from "../api";
import ShipmentTrackingForm from "./admin/ShipmentTrackingForm";

type AdminOrderListProps = {
  orders: AdminOrder[];
  loading: boolean;
  error: string;
  totalCount: number;
  totalPages: number;
  search: string;
  setSearch: (value: string) => void;
  archiveFilter: "active" | "archived" | "all";
  setArchiveFilter: (value: "active" | "archived" | "all") => void;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  actionId: string | null;
  currency: Intl.NumberFormat;
  onRefresh: () => void | Promise<void>;
  onToggleArchived: (order: AdminOrder) => void | Promise<void>;
};

export default function AdminOrderList({
  orders,
  loading,
  error,
  totalCount,
  totalPages,
  search,
  setSearch,
  archiveFilter,
  setArchiveFilter,
  page,
  setPage,
  actionId,
  currency,
  onRefresh,
  onToggleArchived,
}: AdminOrderListProps) {
  return (
    <div className="admin-card admin-orders-card">
      <div className="admin-orders-heading">
        <div>
          <h3>All orders</h3>
          <p className="muted">
            Orders placed by customers across your store.
          </p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => void onRefresh()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="admin-list-filters">
        <div className="field">
          <label htmlFor="admin-order-search">Search orders</label>
          <input
            id="admin-order-search"
            type="search"
            value={search}
            placeholder="Email, name, city, status, tracking…"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="admin-order-archive">Order view</label>
          <select
            id="admin-order-archive"
            value={archiveFilter}
            onChange={(event) => {
              setArchiveFilter(event.target.value as "active" | "archived" | "all");
              setPage(1);
            }}
          >
            <option value="active">Active orders</option>
            <option value="archived">Archived orders</option>
            <option value="all">All orders</option>
          </select>
        </div>
      </div>

      {loading && orders.length === 0 ? (
        <p>Loading orders…</p>
      ) : error ? (
        <div>
          <p className="error-message" role="alert">{error}</p>
          <button type="button" onClick={() => void onRefresh()}>
            Try again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <p className="muted">
          {totalCount === 0
            ? "No matching orders were found."
            : "No orders on this page."}
        </p>
      ) : (
        <>
          <p className="muted">
            Showing {orders.length} of {totalCount} orders
          </p>

          <div className="admin-orders-list">
            {orders.map(order => (
              <details className="admin-order" key={order.id}>
                <summary>
                  <div className="admin-order-summary">
                    <div>
                      <strong>{order.customerEmail || "Customer email unavailable"}</strong>
                      <span className="muted">
                        {new Date(order.createdAtUtc).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <strong>{currency.format(order.totalAmount)}</strong>
                      <span className="admin-order-status">{order.status}</span>
                    </div>
                  </div>
                </summary>

                <div className="admin-order-details">
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => void onToggleArchived(order)}
                      disabled={actionId === order.id}
                    >
                      {actionId === order.id
                        ? "Updating…"
                        : order.isArchived ? "Unarchive order" : "Archive order"}
                    </button>
                    {order.isArchived && <span className="muted">Archived</span>}
                  </div>
                  <p><strong>Order ID:</strong> {order.id}</p>
                  <p><strong>Payment status:</strong> {order.status}</p>
                  {order.paidAtUtc && (
                    <p>
                      <strong>Paid:</strong>{" "}
                      {new Date(order.paidAtUtc).toLocaleString()}
                    </p>
                  )}

                  <h4>Ship to</h4>
                  <div className="admin-order-shipping-address">
                    <strong>{order.shippingName || "Recipient name unavailable"}</strong>
                    {order.shippingStreet1 && <p>{order.shippingStreet1}</p>}
                    {order.shippingStreet2 && <p>{order.shippingStreet2}</p>}
                    <p>
                      {[order.shippingCity, order.shippingState, order.shippingPostalCode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {order.shippingCountry && <p>{order.shippingCountry}</p>}
                  </div>

                  <h4>Shipping</h4>
                  <p>
                    <strong>Carrier:</strong>{" "}
                    {order.shippingProvider || "Not specified"}
                  </p>
                  <p>
                    <strong>Service:</strong>{" "}
                    {order.shippingServiceName || "Not specified"}
                  </p>
                  <p>
                    <strong>Shipping cost:</strong>{" "}
                    {currency.format(order.shippingAmount)}
                  </p>

                  <h4>Fulfillment</h4>
                  <p>
                    <strong>Fulfillment status:</strong>{" "}
                    {order.fulfillmentStatus === "PartiallyShipped"
                      ? "Partially shipped"
                      : order.fulfillmentStatus}
                  </p>

                  {(order.shipments.length > 0
                    ? order.shipments
                    : [{
                        id: "",
                        parcelNumber: 1,
                        carrier: order.shippingProvider,
                        serviceName: order.shippingServiceName,
                        status: "Pending",
                        trackingNumber: null,
                        trackingUrl: null,
                        shippedAtUtc: null,
                      }]
                  ).map(shipment => (
                    <ShipmentTrackingForm
                      key={`${order.id}-parcel-${shipment.parcelNumber}`}
                      orderId={order.id}
                      shipment={shipment}
                      onSaved={() => onRefresh()}
                    />
                  ))}

                  <h4>Items</h4>
                  <ul>
                    {order.items.map((item, index) => (
                      <li key={`${item.productId}-${index}`}>
                        {item.productName} × {item.quantity}
                        {" — "}
                        {currency.format(item.unitPrice * item.quantity)}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>

          <div className="admin-pagination">
            <button
              type="button"
              className="button button-secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage(currentPage => currentPage - 1)}
            >
              Previous
            </button>
            <span>
              Showing {totalCount === 0 ? 0 : (page - 1) * 10 + 1}–
              {Math.min(page * 10, totalCount)} of {totalCount}
              {" · "}Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              className="button button-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(currentPage => currentPage + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
