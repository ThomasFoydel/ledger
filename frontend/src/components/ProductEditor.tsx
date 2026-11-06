import type { Dispatch, FormEvent, SetStateAction } from "react";
import {
  getProductImageUrl,
  type Product,
  type ProductInput,
} from "../api";

type ProductEditorProps = {
  form: ProductInput;
  setForm: Dispatch<SetStateAction<ProductInput>>;
  priceDraft: string;
  setPriceDraft: (value: string) => void;
  quantityDraft: string;
  setQuantityDraft: (value: string) => void;
  editingId: string | null;
  editingProduct: Product | undefined;
  productImagePreviewUrl: string | null;
  productImageVersion: number;
  submitting: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSelectImage: (file: File | undefined) => void;
  onCancel: () => void;
};

export default function ProductEditor({
  form,
  setForm,
  priceDraft,
  setPriceDraft,
  quantityDraft,
  setQuantityDraft,
  editingId,
  editingProduct,
  productImagePreviewUrl,
  productImageVersion,
  submitting,
  error,
  onSubmit,
  onSelectImage,
  onCancel,
}: ProductEditorProps) {
  return (
    <div className="admin-card">
      <h3>{editingId ? "Edit product" : "Add a product"}</h3>

      <form className="product-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="product-name">Product name</label>
          <input
            id="product-name"
            required
            maxLength={200}
            value={form.name}
            onChange={(event) =>
              setForm({ ...form, name: event.target.value })
            }
          />
        </div>

        <div className="field">
          <label htmlFor="product-description">Description</label>
          <textarea
            id="product-description"
            maxLength={2000}
            rows={3}
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </div>

        <div className="field">
          <label htmlFor="product-tags">Search tags</label>
          <input
            id="product-tags"
            type="text"
            value={form.tags.join(",")}
            onChange={(event) =>
              setForm({ ...form, tags: event.target.value.split(",") })
            }
            placeholder="e.g. lavender, floral, relaxing"
            disabled={submitting}
          />
          <p className="muted">
            Separate tags with commas. Customers can search these tags,
            but they are not displayed on the storefront.
          </p>
        </div>

        <div className="admin-form-row">
          <div className="field">
            <label htmlFor="product-price">Price (USD)</label>
            <input
              id="product-price"
              type="number"
              min="0"
              max="99999999.99"
              step="0.01"
              required
              value={priceDraft}
              onChange={(event) => setPriceDraft(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="product-quantity">Quantity on hand</label>
            <input
              id="product-quantity"
              type="number"
              min="0"
              step="1"
              required
              value={quantityDraft}
              onChange={(event) => setQuantityDraft(event.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="product-image">
            Product image (PNG, JPEG, or WebP; max 2 MB)
          </label>

          {(productImagePreviewUrl || editingProduct?.hasImage) && (
            <div className="logo-preview">
              <img
                src={
                  productImagePreviewUrl ??
                  getProductImageUrl(
                    editingProduct!.id,
                    productImageVersion,
                  )
                }
                alt={
                  productImagePreviewUrl
                    ? "Selected product image preview"
                    : "Current product image"
                }
              />
            </div>
          )}

          <input
            id="product-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={submitting}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              onSelectImage(file);
            }}
          />
          <p className="muted">
            Selecting a new image replaces the current product image.
          </p>
        </div>

        {error && (
          <p className="error-message" role="alert">{error}</p>
        )}

        <div className="form-actions">
          <button
            type="submit"
            className="button button-primary"
            disabled={submitting}
          >
            {submitting
              ? "Saving…"
              : editingId
                ? "Save changes"
                : "Add product"}
          </button>

          {editingId && (
            <button
              type="button"
              className="button button-secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
