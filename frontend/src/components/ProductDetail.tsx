import { Link } from "react-router-dom";
import {
  getProductImageUrl,
  type Product,
} from "../api";

type ProductDetailProps = {
  selectedProduct: Product | undefined;
  productImageVersion: number;
  detailQuantity: string;
  setDetailQuantity: (quantity: string) => void;
  currency: Intl.NumberFormat;
  error: string;
  cartItemCount: number;
  addToCart: (product: Product, quantity: number) => void;
  setCartDrawerOpen: (open: boolean) => void;
};

export default function ProductDetail({
  selectedProduct,
  productImageVersion,
  detailQuantity,
  setDetailQuantity,
  currency,
  error,
  cartItemCount,
  addToCart,
  setCartDrawerOpen,
}: ProductDetailProps) {
  return (
    <section className="detail-section">
      {selectedProduct ? (
        <div className="product-detail">
          <div className="product-detail-art">
            {selectedProduct.hasImage ? (
              <img
                src={getProductImageUrl(
                  selectedProduct.id,
                  productImageVersion,
                )}
                alt={selectedProduct.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <span aria-hidden="true">
                {selectedProduct.name.trim().charAt(0).toLocaleUpperCase()}
              </span>
            )}
          </div>

          <div className="product-detail-content">
            <Link className="back-link" to="/">
              ← Back to all products
            </Link>
            <p className="eyebrow">PRODUCT DETAILS</p>
            <h1>{selectedProduct.name}</h1>
            <p className="detail-price">
              {currency.format(selectedProduct.price)}
            </p>
            <p className="detail-description">
              {selectedProduct.description || "Discover the details of this item."}
            </p>
            <p className={
              selectedProduct.quantityOnHand > 0
                ? "stock-status"
                : "stock-status stock-unavailable"
            }>
              <span className="stock-dot" aria-hidden="true" />
              {selectedProduct.quantityOnHand > 0
                ? `${selectedProduct.quantityOnHand} available`
                : "Out of stock"}
            </p>

            {selectedProduct.quantityOnHand > 0 && (
              <div className="detail-purchase">
                <label htmlFor="detail-quantity">Quantity</label>
                <input
                  id="detail-quantity"
                  type="number"
                  min={1}
                  max={selectedProduct.quantityOnHand}
                  step={1}
                  value={detailQuantity}
                  onChange={(event) => setDetailQuantity(event.target.value)}
                  onBlur={() => {
                    const value = Number(detailQuantity);
                    const normalized =
                      Number.isInteger(value) && value > 0
                        ? Math.min(value, selectedProduct.quantityOnHand)
                        : 1;
                    setDetailQuantity(String(normalized));
                  }}
                />
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    const value = Number(detailQuantity);
                    const quantity =
                      Number.isInteger(value) && value > 0
                        ? Math.min(value, selectedProduct.quantityOnHand)
                        : 1;
                    addToCart(selectedProduct, quantity);
                    setDetailQuantity(String(quantity));
                  }}
                >
                  Add to cart
                </button>
              </div>
            )}
            {error && <p className="error-message" role="alert">{error}</p>}
            <button
              type="button"
              className="continue-shopping-link detail-cart-link"
              onClick={() => setCartDrawerOpen(true)}
            >
              View cart ({cartItemCount})
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <h1>Product not found</h1>
          <p>This product may have been removed or is no longer available.</p>
          <Link className="button button-primary" to="/">
            Browse products
          </Link>
        </div>
      )}
    </section>
  );
}
