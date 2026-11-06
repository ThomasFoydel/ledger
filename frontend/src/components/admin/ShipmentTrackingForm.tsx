import type { FormEvent } from "react";
import { useState } from "react";
import { updateOrderShipmentTracking, type OrderShipment } from "../../api";

type ShipmentTrackingFormProps = {
  orderId: string;
  shipment: OrderShipment;
  onSaved: () => void | Promise<void>;
};

export default function ShipmentTrackingForm({
  orderId,
  shipment,
  onSaved,
}: ShipmentTrackingFormProps) {
  const [trackingNumber, setTrackingNumber] = useState(
    shipment.trackingNumber ?? "",
  );
  const [trackingUrl, setTrackingUrl] = useState(
    shipment.trackingUrl ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateOrderShipmentTracking(
        orderId,
        shipment.parcelNumber,
        trackingNumber.trim() || null,
        trackingUrl.trim() || null,
      );
      setMessage("Tracking information saved.");
      await onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save tracking information.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateOrderShipmentTracking(
        orderId,
        shipment.parcelNumber,
        null,
        null,
      );
      setTrackingNumber("");
      setTrackingUrl("");
      setMessage("Tracking information cleared.");
      await onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not clear tracking information.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="shipment-tracking-form" onSubmit={handleSubmit}>
      <h5>Parcel {shipment.parcelNumber} tracking</h5>
      {shipment.carrier && (
        <p className="muted">
          {shipment.carrier}
          {shipment.serviceName ? ` · ${shipment.serviceName}` : ""}
        </p>
      )}

      <div className="field">
        <label htmlFor={`tracking-number-${orderId}-${shipment.parcelNumber}`}>
          Tracking number
        </label>
        <input
          id={`tracking-number-${orderId}-${shipment.parcelNumber}`}
          value={trackingNumber}
          onChange={event => setTrackingNumber(event.target.value)}
          maxLength={100}
          placeholder="Enter tracking number"
        />
      </div>

      <div className="field">
        <label htmlFor={`tracking-url-${orderId}-${shipment.parcelNumber}`}>
          Tracking URL (optional)
        </label>
        <input
          id={`tracking-url-${orderId}-${shipment.parcelNumber}`}
          type="url"
          value={trackingUrl}
          onChange={event => setTrackingUrl(event.target.value)}
          maxLength={500}
          placeholder="https://..."
        />
      </div>

      <div className="shipment-tracking-actions">
        <button
          type="submit"
          className="button button-primary"
          disabled={saving || !trackingNumber.trim()}
        >
          {saving
            ? "Saving…"
            : shipment.trackingNumber
              ? "Update tracking"
              : "Save tracking"}
        </button>
        {shipment.trackingNumber && (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void handleClear()}
            disabled={saving}
          >
            Clear tracking
          </button>
        )}
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="muted" role="status">{message}</p>}
    </form>
  );
}
