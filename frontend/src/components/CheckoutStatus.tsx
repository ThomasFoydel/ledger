import { Link } from "react-router-dom";

type CheckoutStatusProps = {
  isCheckoutSuccessRoute: boolean;
  isCheckoutCancelRoute: boolean;
  checkoutSessionId: string | null;
  checkoutStatus: string | null;
  checkoutStatusError: string;
  orderId?: string;
};

export default function CheckoutStatus({
  isCheckoutSuccessRoute,
  isCheckoutCancelRoute,
  checkoutSessionId,
  checkoutStatus,
  checkoutStatusError,
  orderId,
}: CheckoutStatusProps) {
  return (
        <section className="cart-section">
          <div className="cart-heading">
            <p className="eyebrow">CHECKOUT</p>
            <h1>{isCheckoutSuccessRoute ? "Order status" : "Checkout cancelled"}</h1>
          </div>

          {isCheckoutCancelRoute ? (
            <div className="empty-state">
              <h2>Your order has not been completed</h2>
              <p>Your cart is still saved. You can return to it whenever you are ready.</p>
              <Link className="button button-primary" to="/cart">Return to cart</Link>
            </div>
          ) : (
            <div className="empty-state">
              {!checkoutSessionId ? (
                <>
                  <h2>Unable to verify payment</h2>
                  <p role="alert" className="error-message">
                    The checkout session ID is missing.
                  </p>
                </>
              ) : checkoutStatusError ? (
                <>
                  <h2>Unable to verify payment</h2>
                  <p role="alert" className="error-message">{checkoutStatusError}</p>
                  <p>Please do not submit another payment until you have checked your order status.</p>
                </>
              ) : checkoutStatus === "Paid" ? (
                <>
                  <h2>Payment confirmed</h2>
                  <p>Thank you. Your payment has been confirmed and your order is recorded.</p>
                  <p>
                    Keep an eye on your email for your USPS tracking number once your order ships.
                    If you don't see the email, please check your spam folder.
                  </p>
                  {orderId && (
                    <p>
                      <strong>Order number:</strong>{" "}
                      {orderId}
                    </p>
                  )}
                  <div className="checkout-success-actions">
                    <Link className="button button-primary" to="/orders">
                      View my orders
                    </Link>
                    <Link className="button button-secondary" to="/">
                      Continue shopping
                    </Link>
                  </div>
                </>
              ) : checkoutStatus === "PaidInventoryIssue" ? (
                <>
                  <h2>Payment received; order needs review</h2>
                  <p>Your payment was received, but inventory needs manual review. Please contact the store before placing another order.</p>
                </>
              ) : checkoutStatus === "Cancelled" ? (
                <>
                  <h2>This checkout session expired</h2>
                  <p>Your cart has been preserved. Start checkout again when you are ready.</p>
                  <Link className="button button-primary" to="/cart">Return to cart</Link>
                </>
              ) : (
                <>
                  <h2>{checkoutStatus === "Pending" || checkoutStatus === "CheckoutFailed" ? "Payment not yet confirmed" : "Checking your payment…"}</h2>
                  <p>Payment is confirmed through a secure server-side notification. This page alone does not confirm payment.</p>
                  <button type="button" className="button button-secondary" onClick={() => window.location.reload()}>Check status again</button>
                  <Link className="continue-shopping-link" to="/">Continue shopping</Link>
                </>
              )}
            </div>
          )}
        </section>
  );
}
