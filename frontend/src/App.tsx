import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Product, SiteSettings } from "./api";
import "./App.css";
import AdminPage from "./components/AdminPage";
import CartDrawer from "./components/CartDrawer";
import CartItems from "./components/CartItems";
import CheckoutStatus from "./components/CheckoutStatus";
import CheckoutSummary from "./components/CheckoutSummary";
import CustomerOrderList from "./components/CustomerOrderList";
import LoginDialog from "./components/LoginDialog";
import ProductCatalog from "./components/ProductCatalog";
import ProductDetail from "./components/ProductDetail";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";
import { useAuthentication } from "./hooks/useAuthentication";
import useCart from "./hooks/useCart";
import { useCheckout } from "./hooks/useCheckout";
import { useStorefrontData } from "./hooks/useStorefrontData";

const defaultSiteSettings: SiteSettings = {
  pageTitle: "",
  headerText: "",
  heroTitle: "Find something\nworth keeping.",
  heroDescription:
    "Browse our collection and find just what you’re looking for.",
  footerText: "Thoughtfully managed. Simply shopped.",
  logoUrl: null,
  faviconUrl: null,
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function App() {
  const { pathname, search: locationSearch } = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminProductsRoute = pathname === "/admin/products";
  const isAdminStorefrontRoute = pathname === "/admin/storefront";
  const isAdminOrdersRoute = pathname === "/admin/orders";
  const isCartRoute = pathname === "/cart";
  const isOrdersRoute = pathname === "/orders";
  const isCheckoutSuccessRoute = pathname === "/checkout/success";
  const isCheckoutCancelRoute = pathname === "/checkout/cancel";
  const isCheckoutRoute = isCheckoutSuccessRoute || isCheckoutCancelRoute;
  const checkoutSessionId = new URLSearchParams(locationSearch).get(
    "session_id",
  );
  const isProductRoute =
    pathname.startsWith("/products/") && pathname.split("/").length === 3;

  const [detailQuantityState, setDetailQuantityState] = useState({
    pathname,
    quantity: "1",
  });
  const detailQuantity =
    detailQuantityState.pathname === pathname
      ? detailQuantityState.quantity
      : "1";
  const setDetailQuantity = (quantity: string) =>
    setDetailQuantityState({ pathname, quantity });
  const [siteSettings, setSiteSettings] =
    useState<SiteSettings>(defaultSiteSettings);
  const [productImageVersion, setProductImageVersion] = useState(0);
  const [search, setSearch] = useState("");

  const [cartQuantityDrafts, setCartQuantityDrafts] = useState<
    Record<string, string>
  >({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const cart = useCart();
  const {
    setCartItems,
    cartDrawerOpen,
    setCartDrawerOpen,
    cartDrawerRef,
    cartTriggerRef,
    cartItemCount,
  } = cart;

  const {
    user,
    setUser,
    products,
    setProducts,
    orders,
    ordersLoading,
    ordersError,
    loading,
    searchResults,
    loadProducts,
    loadOrders,
  } = useStorefrontData({
    isOrdersRoute,
    search,
    setSiteSettings,
    setError,
  });

  const {
    loginOpen,
    setLoginOpen,
    isRegistering,
    setIsRegistering,
    email,
    setEmail,
    password,
    setPassword,
    handleLogin,
    handleRegister,
    handleLogout,
  } = useAuthentication({
    setUser,
    setError,
    setSubmitting,
    loadProducts,
    navigateToAdmin: () => navigate("/admin/products", { replace: true }),
  });

  useEffect(() => {
    document.title = siteSettings.pageTitle || import.meta.env.VITE_SITE_TITLE || "";
  }, [siteSettings.pageTitle]);

  useEffect(() => {
    if (loading) return;
    const validProductRoute = /^\/products\/[^/]+$/.test(pathname);
    const validAdminRoute =
      pathname === "/admin" ||
      pathname === "/admin/products" ||
      pathname === "/admin/storefront" ||
      pathname === "/admin/orders";

    if (pathname === "/admin") {
      navigate(user?.isAdmin ? "/admin/products" : "/", { replace: true });
      return;
    }

    if (
      pathname !== "/" &&
      !validAdminRoute &&
      pathname !== "/cart" &&
      pathname !== "/orders" &&
      pathname !== "/checkout/success" &&
      pathname !== "/checkout/cancel" &&
      !validProductRoute
    ) {
      navigate("/", { replace: true });
      return;
    }
    if (isAdminRoute && !user?.isAdmin) {
      navigate("/", { replace: true });
      return;
    }
    if (isOrdersRoute && !user) {
      navigate("/", { replace: true });
    }
  }, [loading, pathname, isAdminRoute, isOrdersRoute, user, navigate]);

  const filteredProducts = useMemo(
    () => (search.trim() ? (searchResults ?? products) : products),
    [products, search, searchResults],
  );

  const selectedProduct = products.find(
    (product) => pathname === `/products/${encodeURIComponent(product.id)}`,
  );

  const cartProductItems = cart.getCartProductItems(products);
  const cartSubtotal = cartProductItems.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );

  const {
    shippingDestination,
    setShippingDestination,
    shippingRates,
    selectedShippingServiceToken,
    setSelectedShippingServiceToken,
    shippingLoading,
    shippingError,
    checkoutResult,
    checkoutStatus,
    checkoutStatusError,
    resetShippingSelection,
    handleGetShippingRates,
    handleCheckout,
  } = useCheckout({
    isCheckoutSuccessRoute,
    checkoutSessionId,
    items: cartProductItems,
    setCartItems,
    setError,
    setSubmitting,
  });

  function addToCart(product: Product, quantity = 1) {
    if (!product.isActive || product.quantityOnHand <= 0) {
      setError("This product is currently unavailable.");
      return;
    }

    resetShippingSelection();
    setError("");
    cart.addToCart(product, quantity);
  }

  function updateCartQuantity(product: Product, quantity: number) {
    resetShippingSelection();
    cart.updateCartQuantity(product, quantity);
  }

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = siteSettings.faviconUrl ?? "/favicon.ico";
  }, [siteSettings.faviconUrl]);

  if (loading) {
    return (
      <main className="app-shell loading-screen">
        <div className="loading-content">
          <p>Loading…</p>
          <span className="loading-spinner" role="status" aria-label="Loading" />
        </div>
      </main>
    );
  }

  return (
    <main className="storefront">
      <SiteHeader
        siteSettings={siteSettings}
        user={user}
        isAdminRoute={isAdminRoute}
        cartTriggerRef={cartTriggerRef}
        cartItemCount={cartItemCount}
        cartDrawerOpen={cartDrawerOpen}
        setCartDrawerOpen={setCartDrawerOpen}
        submitting={submitting}
        onLogout={() => void handleLogout()}
        onSignIn={() => {
          setError("");
          setLoginOpen(true);
        }}
      />

      {!isAdminRoute && (
        <>
          {(isCheckoutSuccessRoute || isCheckoutCancelRoute) && (
            <CheckoutStatus
              isCheckoutSuccessRoute={isCheckoutSuccessRoute}
              isCheckoutCancelRoute={isCheckoutCancelRoute}
              checkoutSessionId={checkoutSessionId}
              checkoutStatus={checkoutStatus}
              checkoutStatusError={checkoutStatusError}
              orderId={checkoutResult?.orderId}
            />
          )}

          {!isProductRoute &&
            !isCartRoute &&
            !isCheckoutRoute &&
            !isOrdersRoute && (
              <section className="store-hero" id="home">
                <div className="hero-content">
                  <p className="eyebrow">
                    {siteSettings.headerText.toLocaleUpperCase()}
                  </p>
                  <h1>
                    {siteSettings.heroTitle.split("\n").map((line, index) => (
                      <span key={index}>
                        {index > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </h1>
                  <p className="hero-description">
                    {siteSettings.heroDescription}
                  </p>

                  <a className="button button-light" href="#products">
                    Explore the store <span aria-hidden="true">↓</span>
                  </a>
                </div>
                <div className="hero-decoration" aria-hidden="true">
                  <div className="hero-circle hero-circle-one" />
                  <div className="hero-circle hero-circle-two" />
                  <div className="hero-letter">
                    {siteSettings.headerText
                      .trim()
                      .charAt(0)
                      .toLocaleUpperCase() || "L"}
                  </div>
                </div>
              </section>
            )}

          {!isProductRoute &&
            !isCartRoute &&
            !isCheckoutRoute &&
            !isOrdersRoute && (
              <ProductCatalog
                products={products}
                filteredProducts={filteredProducts}
                search={search}
                setSearch={setSearch}
                error={error}
                loginOpen={loginOpen}
                productImageVersion={productImageVersion}
                currency={currency}
                userIsAdmin={Boolean(user?.isAdmin)}
                submitting={submitting}
                onEdit={(product) =>
                  navigate("/admin/products", {
                    state: { editProduct: product },
                  })
                }
                onDelete={(product) =>
                  navigate("/admin/products", {
                    state: { deleteProduct: product },
                  })
                }
              />
            )}

          {isProductRoute && (
            <ProductDetail
              selectedProduct={selectedProduct}
              productImageVersion={productImageVersion}
              detailQuantity={detailQuantity}
              setDetailQuantity={setDetailQuantity}
              currency={currency}
              error={error}
              cartItemCount={cartItemCount}
              addToCart={addToCart}
              setCartDrawerOpen={setCartDrawerOpen}
            />
          )}

          {isCartRoute && (
            <section className="cart-section">
              <div className="cart-heading">
                <p className="eyebrow">YOUR SELECTION</p>
                <h1>Shopping cart</h1>
              </div>

              <CartItems
                items={cartProductItems}
                currency={currency}
                quantityDrafts={cartQuantityDrafts}
                setQuantityDrafts={setCartQuantityDrafts}
                onUpdateQuantity={updateCartQuantity}
              />

              {cartProductItems.length > 0 && (
                <div className="cart-layout">
                  <div />
                  <CheckoutSummary
                    items={cartProductItems}
                    destination={shippingDestination}
                    setDestination={setShippingDestination}
                    shippingRates={shippingRates}
                    selectedShippingServiceToken={selectedShippingServiceToken}
                    setSelectedShippingServiceToken={
                      setSelectedShippingServiceToken
                    }
                    shippingLoading={shippingLoading}
                    shippingError={shippingError}
                    submitting={submitting}
                    error={error}
                    subtotal={cartSubtotal}
                    currency={currency}
                    onGetShippingRates={handleGetShippingRates}
                    onCheckout={() => void handleCheckout()}
                  />
                </div>
              )}
            </section>
          )}

          {!isAdminRoute && cartDrawerOpen && (
            <CartDrawer
              drawerRef={cartDrawerRef}
              cartItemCount={cartItemCount}
              cartProductItems={cartProductItems}
              cartSubtotal={cartSubtotal}
              currency={currency}
              cartQuantityDrafts={cartQuantityDrafts}
              setCartQuantityDrafts={setCartQuantityDrafts}
              onClose={() => setCartDrawerOpen(false)}
              onUpdateQuantity={updateCartQuantity}
            />
          )}

          {isOrdersRoute && user && (
            <CustomerOrderList
              orders={orders}
              loading={ordersLoading}
              error={ordersError}
              onRefresh={loadOrders}
            />
          )}
        </>
      )}

      {user?.isAdmin && isAdminRoute && (
        <AdminPage
          loading={loading}
          user={user}
          routes={{
            isAdminProductsRoute,
            isAdminOrdersRoute,
            isAdminStorefrontRoute,
          }}
          storefront={{
            products,
            setProducts,
            loadProducts,
            siteSettings,
            setSiteSettings,
          }}
          shared={{
            error,
            setError,
            submitting,
            setSubmitting,
            currency,
            productImageVersion,
            onProductImageUpdated: () =>
              setProductImageVersion((version) => version + 1),
          }}
        />
      )}

      {!isAdminRoute && <SiteFooter siteSettings={siteSettings} />}

      {loginOpen && (
        <LoginDialog
          isRegistering={isRegistering}
          setIsRegistering={setIsRegistering}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          error={error}
          setError={setError}
          submitting={submitting}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onClose={() => {
            setLoginOpen(false);
            setError("");
          }}
        />
      )}
    </main>
  );
}

export default App;
