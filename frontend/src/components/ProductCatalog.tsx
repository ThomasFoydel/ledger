import { Link } from "react-router-dom";
import { getProductImageUrl, type Product } from "../api";

type ProductCatalogProps = {
  products: Product[];
  filteredProducts: Product[];
  search: string;
  setSearch: (value: string) => void;
  error: string;
  loginOpen: boolean;
  productImageVersion: number;
  currency: Intl.NumberFormat;
  userIsAdmin: boolean;
  submitting: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void | Promise<void>;
};

export default function ProductCatalog({
  products,
  filteredProducts,
  search,
  setSearch,
  error,
  loginOpen,
  productImageVersion,
  currency,
  userIsAdmin,
  submitting,
  onEdit,
  onDelete,
}: ProductCatalogProps) {
  return (
    <section className="catalog-section" id="products">
      <div className="catalog-heading">
        <div>
          <p className="eyebrow">OUR COLLECTION</p>
          <h2>Shop all products</h2>
          <p className="muted">
            {filteredProducts.length}{" "}
            {filteredProducts.length === 1 ? "item" : "items"} to explore
          </p>
        </div>

        <div className="search-wrapper">
          <label className="visually-hidden" htmlFor="product-search">
            Search products
          </label>
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            id="product-search"
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {error && !loginOpen && (
        <p className="error-message" role="alert">{error}</p>
      )}

      {products.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">◇</span>
          <h3>The shelves are empty for now</h3>
          <p>Check back soon for new products.</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">⌕</span>
          <h3>No matching products</h3>
          <p>Try a different search term.</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setSearch("")}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="product-grid">
          {filteredProducts.map((product) => (
            <article className="product-card" key={product.id}>
              <Link
                className={`product-art product-art-link${product.hasImage ? " product-art-has-image" : ""}`}
                to={`/products/${encodeURIComponent(product.id)}`}
                aria-label={`View ${product.name}`}
              >
                {product.hasImage ? (
                  <img
                    src={getProductImageUrl(product.id, productImageVersion)}
                    alt={product.name}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span className="product-art-letter">
                    {product.name.trim().charAt(0).toLocaleUpperCase()}
                  </span>
                )}
                <span className="product-art-index">
                  {String(products.indexOf(product) + 1).padStart(2, "0")}
                </span>
              </Link>

              <div className="product-card-body">
                <div className="product-card-heading">
                  <h3>
                    <Link
                      className="product-title-link"
                      to={`/products/${encodeURIComponent(product.id)}`}
                    >
                      {product.name}
                    </Link>
                  </h3>
                  <strong className="product-price">
                    {currency.format(product.price)}
                  </strong>
                </div>

                <p className="product-description">
                  {product.description || "Discover the details of this item."}
                </p>

                <div className="product-card-footer">
                  <span
                    className={
                      product.quantityOnHand > 0
                        ? "stock-status"
                        : "stock-status stock-unavailable"
                    }
                  >
                    <span className="stock-dot" aria-hidden="true" />
                    {product.quantityOnHand > 0
                      ? "In stock"
                      : "Out of stock"}
                  </span>

                  {userIsAdmin && (
                    <div className="product-admin-actions">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onEdit(product)}
                        disabled={submitting}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-button text-button-danger"
                        onClick={() => void onDelete(product)}
                        disabled={submitting}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
