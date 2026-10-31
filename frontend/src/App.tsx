import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  createCheckoutSession,
  getCheckoutSession,
  createProduct,
  deleteProduct,
  getCurrentUser,
  getProducts,
  getOrders,
  getAdminOrders,
  login,
  register,
  logout,
  updateProduct,
  type Product,
  type ProductInput,
  type CustomerOrder,
  type AdminOrder,
  type User,
  getSiteSettings,
  updateSiteSettings,
  uploadSiteLogo,
  deleteSiteLogo,
  uploadSiteFavicon,
  deleteSiteFavicon,
  type SiteSettings,
} from "./api";
import "./App.css";

const emptyProduct: ProductInput = {
  name: "",
  description: "",
  price: 0,
  quantityOnHand: 0,
};

const defaultSiteSettings: SiteSettings = {
  pageTitle: "Ledger",
  headerText: "Ledger",
  heroTitle: "Find something\nworth keeping.",
  heroDescription: "Browse our collection and find just what you’re looking for.",
  footerText: "Thoughtfully managed. Simply shopped.",
  logoUrl: null,
  faviconUrl: null,
};





const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type CartItem = {
  productId: string;
  quantity: number;
};

const CART_STORAGE_KEY = "ledger-cart";

function withImageCacheBust(settings: SiteSettings): SiteSettings {
  const version = Date.now();
  const bust = (url: string | null) =>
    url ? `${url}${url.includes("?") ? "&" : "?"}v=${version}` : null;

  return {
    ...settings,
    logoUrl: bust(settings.logoUrl),
    faviconUrl: bust(settings.faviconUrl),
  };
}

function App() {
  const { pathname, search: locationSearch } = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = pathname === "/admin";
  const isCartRoute = pathname === "/cart";
  const isOrdersRoute = pathname === "/orders";
  const isCheckoutSuccessRoute = pathname === "/checkout/success";
  const isCheckoutCancelRoute = pathname === "/checkout/cancel";
  const isCheckoutRoute = isCheckoutSuccessRoute || isCheckoutCancelRoute;
  const checkoutSessionId = new URLSearchParams(locationSearch).get("session_id");
  const isProductRoute =
    pathname.startsWith("/products/") && pathname.split("/").length === 3;

  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>([]);
  const [adminOrdersLoading, setAdminOrdersLoading] = useState(false);
  const [adminOrdersError, setAdminOrdersError] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (!saved) return [];

      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      return parsed.filter(
        (item): item is CartItem =>
          typeof item?.productId === "string" &&
          Number.isInteger(item?.quantity) &&
          item.quantity > 0,
      );
    } catch {
      return [];
    }
  });
  const [detailQuantityState, setDetailQuantityState] = useState({
    pathname,
    quantity: 1,
  });
  const detailQuantity =
    detailQuantityState.pathname === pathname ? detailQuantityState.quantity : 1;
  const setDetailQuantity = (quantity: number) =>
    setDetailQuantityState({ pathname, quantity });
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [siteSettingsForm, setSiteSettingsForm] = useState<SiteSettings>(defaultSiteSettings);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingFaviconFile, setPendingFaviconFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [faviconPreviewUrl, setFaviconPreviewUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm] = useState<ProductInput>(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [checkoutResult, setCheckoutResult] = useState<{
    sessionId: string;
    status?: string;
    error?: string;
  } | null>(null);
  const checkoutStatus =
    checkoutResult?.sessionId === checkoutSessionId
      ? checkoutResult.status ?? null
      : null;
  const checkoutStatusError =
    checkoutResult?.sessionId === checkoutSessionId
      ? checkoutResult.error ?? ""
      : "";

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      if (faviconPreviewUrl) URL.revokeObjectURL(faviconPreviewUrl);
    };
  }, [logoPreviewUrl, faviconPreviewUrl]);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (!isCheckoutSuccessRoute || !checkoutSessionId) return;

    const sessionId = checkoutSessionId;

    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const maxAttempts = 20;
    const pollIntervalMs = 1500;

    async function checkStatus() {
      try {
        const result = await getCheckoutSession(sessionId);
        if (!active) return;

        setCheckoutResult({
          sessionId,
          status: result.status,
        });

        if (result.status === "Paid") {
          setCartItems([]);
        }

        if (result.status === "Pending" && attempts < maxAttempts) {
          attempts += 1;
          timeoutId = setTimeout(() => {
            void checkStatus();
          }, pollIntervalMs);
        }
      } catch (err: unknown) {
        if (!active) return;

        setCheckoutResult({
          sessionId,
          error:
            err instanceof Error
              ? err.message
              : "Could not check payment status.",
        });
      }
    }

    void checkStatus();

    return () => {
      active = false;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [isCheckoutSuccessRoute, checkoutSessionId]);

  const loadProducts = useCallback(async () => {
    const items = await getProducts();
    setProducts(items);
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      setOrders(await getOrders());
    } catch (err) {
      setOrdersError(
        err instanceof Error ? err.message : "Unable to load your orders.",
      );
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadAdminOrders = useCallback(async () => {
    setAdminOrdersLoading(true);
    setAdminOrdersError("");
    try {
      setAdminOrders(await getAdminOrders());
    } catch (err) {
      setAdminOrdersError(
        err instanceof Error ? err.message : "Unable to load all orders.",
      );
    } finally {
      setAdminOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && isOrdersRoute && user) {
      void Promise.resolve().then(() => loadOrders());
    }
  }, [loading, isOrdersRoute, user, loadOrders]);

  useEffect(() => {
    if (!loading && isAdminRoute && user?.isAdmin) {
      void Promise.resolve().then(() => loadAdminOrders());
    }
  }, [loading, isAdminRoute, user, loadAdminOrders]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const [currentUser, items, settings] = await Promise.all([
          getCurrentUser(),
          getProducts(),
          getSiteSettings(),
        ]);

        if (!active) return;

        setUser(currentUser);
        setProducts(items);
        setSiteSettings(settings);
        setSiteSettingsForm(settings);
      } catch {
        if (active) {
          setError("Unable to load the store. Please check that the API is running and try again.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.title = siteSettings.pageTitle || "Ledger";
  }, [siteSettings.pageTitle]);

  useEffect(() => {
    if (loading) return;
    const validProductRoute = /^\/products\/[^/]+$/.test(pathname);
    if (
      pathname !== "/" &&
      pathname !== "/admin" &&
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

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    if (!query) return products;

    return products.filter(
      (product) =>
        product.name.toLocaleLowerCase().includes(query) ||
        (product.description ?? "").toLocaleLowerCase().includes(query),
    );
  }, [products, search]);

  const selectedProduct = products.find(
    (product) => pathname === `/products/${encodeURIComponent(product.id)}`,
  );

  const cartProductItems = cartItems.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return product ? [{ ...item, product }] : [];
  });

  const cartItemCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cartProductItems.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );

  function addToCart(product: Product, quantity = 1) {
    if (!product.isActive || product.quantityOnHand <= 0) {
      setError("This product is currently unavailable.");
      return;
    }

    setCartItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      const nextQuantity = Math.min(
        product.quantityOnHand,
        (existing?.quantity ?? 0) + quantity,
      );

      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: nextQuantity }
            : item,
        );
      }

      return [...current, { productId: product.id, quantity: nextQuantity }];
    });
    setError("");
  }

  function updateCartQuantity(product: Product, quantity: number) {
    if (quantity <= 0) {
      setCartItems((current) =>
        current.filter((item) => item.productId !== product.id),
      );
      return;
    }

    setCartItems((current) =>
      current.map((item) =>
        item.productId === product.id
          ? { ...item, quantity: Math.min(quantity, product.quantityOnHand) }
          : item,
      ),
    );
  }

  function resetForm() {
    setForm(emptyProduct);
    setEditingId(null);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);

      const currentUser = await getCurrentUser();

      if (!currentUser) {
        throw new Error("Sign-in succeeded, but your session could not be verified.");
      }

      setUser(currentUser);
      setPassword("");
      setLoginOpen(false);

      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await register(email, password);

      const currentUser = await getCurrentUser();

      if (!currentUser) {
        throw new Error(
          "Account created, but your sign-in session could not be verified.",
        );
      }

      setUser(currentUser);
      setPassword("");
      setLoginOpen(false);
      setIsRegistering(false);

      await loadProducts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create your account.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setError("");
    setSubmitting(true);

    try {
      await logout();
      setUser(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign out.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditing(product: Product) {
    setForm({
      name: product.name,
      description: product.description ?? "",
      price: product.price,
      quantityOnHand: product.quantityOnHand,
    });
    setEditingId(product.id);
    setError("");
    navigate("/admin");
  }

  function handleSelectLogo(file: File | undefined) {
    if (!file) return;
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setPendingLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setError("");
  }

  async function handleRemoveLogo() {
    if (!window.confirm("Remove the store logo?")) return;
    setError("");
    setSubmitting(true);
    try {
      const saved = withImageCacheBust(await deleteSiteLogo());
      setSiteSettings(saved);
      setSiteSettingsForm(saved);
      setPendingLogoFile(null);
      setLogoPreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove logo.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSelectFavicon(file: File | undefined) {
    if (!file) return;
    if (faviconPreviewUrl) URL.revokeObjectURL(faviconPreviewUrl);
    setPendingFaviconFile(file);
    setFaviconPreviewUrl(URL.createObjectURL(file));
    setError("");
  }

  async function handleRemoveFavicon() {
    if (!window.confirm("Remove the favicon?")) return;
    setError("");
    setSubmitting(true);
    try {
      const saved = withImageCacheBust(await deleteSiteFavicon());
      setSiteSettings(saved);
      setSiteSettingsForm(saved);
      setPendingFaviconFile(null);
      setFaviconPreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove favicon.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckout() {
    setError("");
    setSubmitting(true);
    try {
      const session = await createCheckoutSession(
        cartProductItems.map(({ product, quantity }) => ({
          productId: product.id,
          quantity,
        })),
      );
      window.location.assign(session.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setSubmitting(false);
    }
  }

  async function handleSaveSiteSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      let saved = withImageCacheBust(await updateSiteSettings(siteSettingsForm));
      setSiteSettings(saved);
      setSiteSettingsForm(saved);

      if (pendingLogoFile) {
        saved = withImageCacheBust(await uploadSiteLogo(pendingLogoFile));
        setSiteSettings(saved);
        setSiteSettingsForm(saved);
        setPendingLogoFile(null);
        setLogoPreviewUrl(null);
      }

      if (pendingFaviconFile) {
        saved = withImageCacheBust(await uploadSiteFavicon(pendingFaviconFile));
        setSiteSettings(saved);
        setSiteSettingsForm(saved);
        setPendingFaviconFile(null);
        setFaviconPreviewUrl(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save storefront content.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const input: ProductInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      quantityOnHand: Number(form.quantityOnHand),
    };

    try {
      if (editingId) {
        await updateProduct(editingId, input);
      } else {
        await createProduct(input);
      }

      await loadProducts();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save product.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteProduct(product: Product) {
    if (!window.confirm(`Delete "${product.name}"?`)) return;

    setError("");
    setSubmitting(true);

    try {
      await deleteProduct(product.id);
      setProducts((current) =>
        current.filter((item) => item.id !== product.id),
      );

      if (editingId === product.id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete product.");
    } finally {
      setSubmitting(false);
    }
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
        <p>Loading Ledger…</p>
      </main>
    );
  }

  return (
    <main className="storefront">
      <header className="site-header">
        <a className="brand" href={isAdminRoute ? "/" : "#home"} aria-label={`${siteSettings.headerText} home`}>
          {siteSettings.logoUrl ? (
            <img className="brand-logo" src={siteSettings.logoUrl} alt="" />
          ) : (
            <span className="brand-mark" aria-hidden="true">
              {siteSettings.pageTitle.trim().charAt(0).toLocaleUpperCase() || "L"}
            </span>
          )}
          <span>{siteSettings.headerText}</span>
        </a>

        <nav className="header-actions" aria-label="Account">
          {!isAdminRoute && (
            <Link className="cart-nav-link" to="/cart">
              Cart ({cartItemCount})
            </Link>
          )}
          {user ? (
            <>
              <Link className="orders-nav-link" to="/orders">
                Orders
              </Link>
              {user.isAdmin && (
                <Link className="admin-nav-link" to="/admin">
                  Admin
                </Link>
              )}
              <span className="account-email">{user.email}</span>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void handleLogout()}
                disabled={submitting}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setError("");
                setLoginOpen(true);
              }}
            >
              Sign in
            </button>
          )}
        </nav>
      </header>

      {!isAdminRoute && (
        <>
      {(isCheckoutSuccessRoute || isCheckoutCancelRoute) && (
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
                  <Link className="button button-primary" to="/">Continue shopping</Link>
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
                  <p>Ledger confirms payment through a secure server-side notification. This page alone does not confirm payment.</p>
                  <button type="button" className="button button-secondary" onClick={() => window.location.reload()}>Check status again</button>
                  <Link className="continue-shopping-link" to="/">Continue shopping</Link>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {!isProductRoute && !isCartRoute && !isCheckoutRoute && !isOrdersRoute && (
      <section className="store-hero" id="home">
        <div className="hero-content">
          <p className="eyebrow">{siteSettings.headerText.toLocaleUpperCase()}</p>
          <h1>{siteSettings.heroTitle.split("\n").map((line, index) => (
            <span key={index}>{index > 0 && <br />}{line}</span>
          ))}</h1>
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
            {siteSettings.headerText.trim().charAt(0).toLocaleUpperCase() || "L"}
          </div>
        </div>
      </section>
      )}

      {!isProductRoute && !isCartRoute && !isCheckoutRoute && !isOrdersRoute && (
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
                  className="product-art product-art-link"
                  to={`/products/${encodeURIComponent(product.id)}`}
                  aria-label={`View ${product.name}`}
                >
                  <span className="product-art-letter">
                    {product.name.trim().charAt(0).toLocaleUpperCase()}
                  </span>
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

                    {user?.isAdmin && (
                      <div className="product-admin-actions">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => startEditing(product)}
                          disabled={submitting}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-button text-button-danger"
                          onClick={() => void handleDeleteProduct(product)}
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
      )}

      {isProductRoute && (
        <section className="detail-section">
          {selectedProduct ? (
            <div className="product-detail">
              <div className="product-detail-art" aria-hidden="true">
                <span>{selectedProduct.name.trim().charAt(0).toLocaleUpperCase()}</span>
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
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setDetailQuantity(
                          Number.isFinite(value)
                            ? Math.max(
                                1,
                                Math.min(
                                  selectedProduct.quantityOnHand,
                                  Math.floor(value),
                                ),
                              )
                            : 1,
                        );
                      }}
                    />
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => addToCart(selectedProduct, detailQuantity)}
                    >
                      Add to cart
                    </button>
                  </div>
                )}
                {error && <p className="error-message" role="alert">{error}</p>}
                <Link className="continue-shopping-link" to="/cart">
                  View cart ({cartItemCount})
                </Link>
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
      )}

      {isCartRoute && (
        <section className="cart-section">
          <div className="cart-heading">
            <p className="eyebrow">YOUR SELECTION</p>
            <h1>Shopping cart</h1>
          </div>

          {cartProductItems.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">◇</span>
              <h2>Your cart is empty</h2>
              <p>Find something worth keeping.</p>
              <Link className="button button-primary" to="/">
                Browse products
              </Link>
            </div>
          ) : (
            <div className="cart-layout">
              <div className="cart-items">
                {cartProductItems.map(({ product, quantity }) => (
                  <article className="cart-item" key={product.id}>
                    <div className="cart-item-art" aria-hidden="true">
                      {product.name.trim().charAt(0).toLocaleUpperCase()}
                    </div>
                    <div className="cart-item-info">
                      <Link
                        className="product-title-link"
                        to={`/products/${encodeURIComponent(product.id)}`}
                      >
                        {product.name}
                      </Link>
                      <p>{currency.format(product.price)} each</p>
                      {product.quantityOnHand === 0 && (
                        <p className="stock-unavailable">Currently out of stock</p>
                      )}
                      <button
                        type="button"
                        className="text-button text-button-danger"
                        onClick={() => updateCartQuantity(product, 0)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="cart-item-quantity">
                      <label htmlFor={`cart-quantity-${product.id}`}>Qty</label>
                      <input
                        id={`cart-quantity-${product.id}`}
                        type="number"
                        min={1}
                        max={product.quantityOnHand}
                        step={1}
                        value={quantity}
                        disabled={product.quantityOnHand === 0}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (Number.isInteger(value) && value > 0) {
                            updateCartQuantity(product, value);
                          }
                        }}
                      />
                    </div>
                    <strong className="cart-line-total">
                      {currency.format(product.price * quantity)}
                    </strong>
                  </article>
                ))}
              </div>

              <aside className="cart-summary">
                <h2>Order summary</h2>
                <div className="cart-summary-row">
                  <span>Subtotal</span>
                  <strong>{currency.format(cartSubtotal)}</strong>
                </div>
                <p className="muted">
                  Shipping and taxes are calculated during checkout.
                </p>
                <button
                  type="button"
                  className="button button-primary cart-checkout-button"
                  disabled={submitting || cartProductItems.length === 0 || cartProductItems.some(({ product, quantity }) => product.price <= 0 || product.quantityOnHand < quantity)}
                  onClick={() => void handleCheckout()}
                >
                  {submitting ? "Redirecting…" : "Secure checkout"}
                </button>
                {error && <p className="error-message" role="alert">{error}</p>}
                <Link className="continue-shopping-link" to="/">
                  Continue shopping
                </Link>
              </aside>
            </div>
          )}
        </section>
      )}

      {isOrdersRoute && user && (
        <section className="cart-section orders-section">
          <div className="cart-heading">
            <p className="eyebrow">YOUR ACCOUNT</p>
            <h1>Your orders</h1>
            <p className="muted">Review your order history and payment status.</p>
          </div>

          {ordersLoading ? (
            <div className="empty-state" role="status">
              <p>Loading your orders…</p>
            </div>
          ) : ordersError ? (
            <div className="empty-state">
              <p className="error-message" role="alert">{ordersError}</p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void loadOrders()}
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
                    Status: <span className={`order-status order-status-${order.status.toLowerCase()}`}>
                      {order.status}
                    </span>
                  </p>
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
      )}

      </>
      )}

      {user?.isAdmin && isAdminRoute && (
        <section className="admin-section" id="admin-panel">
          <div className="admin-section-heading">
            <div>
              <p className="eyebrow">STORE MANAGEMENT</p>
              <h2>Admin panel</h2>
              <a href="/">Back to storefront</a>
              <p className="muted">
                Manage your catalog and inventory.
              </p>
            </div>
            <span className="admin-badge">Owner access</span>
          </div>

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
                onClick={() => void loadAdminOrders()}
                disabled={adminOrdersLoading}
              >
                {adminOrdersLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {adminOrdersLoading ? (
              <p>Loading orders…</p>
            ) : adminOrdersError ? (
              <div>
                <p className="error-message" role="alert">
                  {adminOrdersError}
                </p>
                <button type="button" onClick={() => void loadAdminOrders()}>
                  Try again
                </button>
              </div>
            ) : adminOrders.length === 0 ? (
              <p>No orders have been placed yet.</p>
            ) : (
              <>
                <p className="muted">
                  {adminOrders.length} {adminOrders.length === 1 ? "order" : "orders"}
                </p>

                <div className="admin-orders-list">
                  {adminOrders.map(order => (
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
                        <p><strong>Order ID:</strong> {order.id}</p>
                        <p><strong>Payment status:</strong> {order.status}</p>
                        {order.paidAtUtc && (
                          <p>
                            <strong>Paid:</strong>{" "}
                            {new Date(order.paidAtUtc).toLocaleString()}
                          </p>
                        )}

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
              </>
            )}
          </div>

          <div className="admin-card">
            <h3>Storefront content</h3>
            <form className="product-form" onSubmit={handleSaveSiteSettings}>
              <div className="field">
                <label htmlFor="site-page-title">Browser page title</label>
                <input id="site-page-title" required maxLength={200}
                  value={siteSettingsForm.pageTitle}
                  onChange={event => setSiteSettingsForm({ ...siteSettingsForm, pageTitle: event.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="site-header-text">Header / store name</label>
                <input id="site-header-text" required maxLength={200}
                  value={siteSettingsForm.headerText}
                  onChange={event => setSiteSettingsForm({ ...siteSettingsForm, headerText: event.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="site-hero-title">Main heading (use a new line for a line break)</label>
                <textarea id="site-hero-title" required maxLength={500} rows={2}
                  value={siteSettingsForm.heroTitle}
                  onChange={event => setSiteSettingsForm({ ...siteSettingsForm, heroTitle: event.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="site-hero-description">Page description</label>
                <textarea id="site-hero-description" required maxLength={2000} rows={3}
                  value={siteSettingsForm.heroDescription}
                  onChange={event => setSiteSettingsForm({ ...siteSettingsForm, heroDescription: event.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="site-footer-text">Footer text</label>
                <input id="site-footer-text" required maxLength={500}
                  value={siteSettingsForm.footerText}
                  onChange={event => setSiteSettingsForm({ ...siteSettingsForm, footerText: event.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="site-favicon">Browser favicon (PNG, JPEG, or WebP; max 2 MB)</label>
                {(faviconPreviewUrl || siteSettings.faviconUrl) && (
                  <div className="logo-preview">
                    <img
                      className="favicon-preview-image"
                      src={faviconPreviewUrl ?? siteSettings.faviconUrl ?? ""}
                      alt={faviconPreviewUrl ? "Selected favicon preview" : "Current favicon"}
                    />
                    <button
                      type="button"
                      className="text-button text-button-danger"
                      onClick={() => void handleRemoveFavicon()}
                      disabled={submitting}
                    >
                      Remove favicon
                    </button>
                  </div>
                )}
                <input
                  id="site-favicon"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={submitting}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    handleSelectFavicon(file);
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="site-logo">Store logo (PNG, JPEG, or WebP; max 2 MB)</label>
                {(logoPreviewUrl || siteSettings.logoUrl) && (
                  <div className="logo-preview">
                    <img
                      src={logoPreviewUrl ?? siteSettings.logoUrl ?? ""}
                      alt={logoPreviewUrl ? "Selected store logo preview" : "Current store logo"}
                    />
                    <button
                      type="button"
                      className="text-button text-button-danger"
                      onClick={() => void handleRemoveLogo()}
                      disabled={submitting}
                    >
                      Remove logo
                    </button>
                  </div>
                )}
                <input
                  id="site-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={submitting}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    handleSelectLogo(file);
                  }}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="button button-primary" disabled={submitting}>
                  {submitting ? "Saving…" : "Save storefront content"}
                </button>
              </div>
            </form>
          </div>

          <div className="admin-card">
            <h3>Manage products</h3>

            {products.length === 0 ? (
              <p className="muted">No products yet. Add a product below.</p>
            ) : (
              <div className="admin-product-list">
                {products.map((product) => (
                  <div className="admin-product-row" key={product.id}>
                    <div>
                      <strong>{product.name}</strong>
                      <p className="muted">
                        {currency.format(product.price)} ·{" "}
                        {product.quantityOnHand} in stock
                      </p>
                    </div>

                    <div className="product-admin-actions">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => startEditing(product)}
                        disabled={submitting}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-button text-button-danger"
                        onClick={() => void handleDeleteProduct(product)}
                        disabled={submitting}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-card">
            <h3>{editingId ? "Edit product" : "Add a product"}</h3>

            <form className="product-form" onSubmit={handleSaveProduct}>
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
                    value={form.price}
                    onChange={(event) =>
                      setForm({ ...form, price: Number(event.target.value) })
                    }
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
                    value={form.quantityOnHand}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        quantityOnHand: Number(event.target.value),
                      })
                    }
                  />
                </div>
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
                    onClick={resetForm}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>
      )}

      {!isAdminRoute && <footer className="site-footer">
        <Link className="brand footer-brand" to="/">
          {siteSettings.logoUrl ? (
            <img className="brand-logo" src={siteSettings.logoUrl} alt="" />
          ) : (
            <span className="brand-mark" aria-hidden="true">
              {siteSettings.pageTitle.trim().charAt(0).toLocaleUpperCase() || "L"}
            </span>
          )}
          <span>{siteSettings.headerText}</span>
        </Link>
        <p>{siteSettings.footerText}</p>
      </footer>}

      {loginOpen && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setLoginOpen(false);
              setError("");
            }
          }}
        >
          <section
            className="login-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
          >
            <button
              type="button"
              className="dialog-close"
              aria-label="Close sign-in dialog"
              onClick={() => {
                setLoginOpen(false);
                setError("");
              }}
              disabled={submitting}
            >
              ×
            </button>

            <span className="brand-mark dialog-brand-mark" aria-hidden="true">
              L
            </span>
            <p className="eyebrow">WELCOME BACK</p>
            <h2 id="login-title">{isRegistering ? "Create your account" : "Sign in to Ledger"}</h2>
            <p className="muted">
              {isRegistering
                ? "Create an account to place orders and track your purchases."
                : "Sign in to access your account."}
            </p>

            <form onSubmit={isRegistering ? handleRegister : handleLogin}>
              <div className="field">
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete={isRegistering ? "new-password" : "current-password"}
                  minLength={isRegistering ? 8 : undefined}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {error && (
                <p className="error-message" role="alert">{error}</p>
              )}

              <button
                type="submit"
                className="button button-primary dialog-submit"
                disabled={submitting}
              >
                {submitting
                  ? (isRegistering ? "Creating account…" : "Signing in…")
                  : (isRegistering ? "Create account" : "Sign in")}
              </button>
            </form>

            <p className="auth-switch">
              {isRegistering ? "Already have an account?" : "New to Ledger?"}{" "}
              <button
                type="button"
                className="auth-switch-button"
                onClick={() => {
                  setIsRegistering((current) => !current);
                  setError("");
                }}
                disabled={submitting}
              >
                {isRegistering ? "Sign in" : "Create an account"}
              </button>
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
