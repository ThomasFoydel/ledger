import type { Dispatch, SetStateAction } from "react";
import type { Product } from "../api";

type AdminProductListProps = {
  products: Product[];
  loading: boolean;
  error: string;
  totalCount: number;
  totalPages: number;
  search: string;
  setSearch: (value: string) => void;
  visibility: "active" | "hidden" | "all";
  setVisibility: (value: "active" | "hidden" | "all") => void;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  actionId: string | null;
  submitting: boolean;
  currency: Intl.NumberFormat;
  onRefresh: () => void | Promise<void>;
  onEdit: (product: Product) => void | Promise<void>;
  onToggleVisibility: (product: Product) => void | Promise<void>;
  onDelete: (product: Product) => void | Promise<void>;
};

export default function AdminProductList({
  products,
  loading,
  error,
  totalCount,
  totalPages,
  search,
  setSearch,
  visibility,
  setVisibility,
  page,
  setPage,
  actionId,
  submitting,
  currency,
  onRefresh,
  onEdit,
  onToggleVisibility,
  onDelete,
}: AdminProductListProps) {
  return (
    <div className="admin-card admin-products-card">
      <h3>Manage products</h3>

      <div className="admin-list-filters">
        <div className="field">
          <label htmlFor="admin-product-search">Search products</label>
          <input
            id="admin-product-search"
            type="search"
            value={search}
            placeholder="Name, description, or tag…"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="admin-product-visibility">Product visibility</label>
          <select
            id="admin-product-visibility"
            value={visibility}
            onChange={(event) => {
              setVisibility(event.target.value as "active" | "hidden" | "all");
              setPage(1);
            }}
          >
            <option value="active">Active products</option>
            <option value="hidden">Hidden products</option>
            <option value="all">All products</option>
          </select>
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

      {loading && products.length === 0 ? (
        <p>Loading products…</p>
      ) : error ? (
        <div>
          <p className="error-message" role="alert">{error}</p>
          <button type="button" onClick={() => void onRefresh()}>
            Try again
          </button>
        </div>
      ) : products.length === 0 ? (
        <p className="muted">
          {totalCount === 0
            ? "No matching products. You can add a product below."
            : "No products on this page."}
        </p>
      ) : (
        <>
          <p className="muted">
            Showing {products.length} of {totalCount} products
          </p>
          <div className="admin-product-list">
            {products.map((product) => (
              <div className="admin-product-row" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <p className="muted">
                    {currency.format(product.price)} ·{" "}
                    {product.quantityOnHand} in stock ·{" "}
                    {product.isActive ? "Visible" : "Hidden"}
                  </p>
                </div>
                <div className="product-admin-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void onEdit(product)}
                    disabled={submitting || actionId === product.id}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void onToggleVisibility(product)}
                    disabled={actionId === product.id}
                  >
                    {actionId === product.id
                      ? "Updating…"
                      : product.isActive ? "Hide" : "Unhide"}
                  </button>
                  <button
                    type="button"
                    className="text-button text-button-danger"
                    onClick={() => void onDelete(product)}
                    disabled={submitting || actionId === product.id}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="admin-pagination">
            <button
              type="button"
              className="button button-secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((currentPage) => currentPage - 1)}
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
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
