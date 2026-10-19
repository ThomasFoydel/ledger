import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  createProduct,
  deleteProduct,
  getCurrentUser,
  getProducts,
  login,
  logout,
  updateProduct,
  type Product,
  type ProductInput,
  type User,
  getSiteSettings,
  updateSiteSettings,
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
  heroTitle: "Find something\\nworth keeping.",
  heroDescription: "Browse our collection and find just what you’re looking for.",
  footerText: "Thoughtfully managed. Simply shopped.",
};





const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function App() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = pathname === "/admin";
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [siteSettingsForm, setSiteSettingsForm] = useState<SiteSettings>(defaultSiteSettings);
  const [search, setSearch] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm] = useState<ProductInput>(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    const items = await getProducts();
    setProducts(items);
  }, []);

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
        setSiteSettings(settings);
        setSiteSettingsForm(settings);
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
    document.title = siteSettings.pageTitle || "Ledger";
  }, [siteSettings.pageTitle]);

  useEffect(() => {
    document.title = siteSettings.pageTitle || "Ledger";
  }, [siteSettings.pageTitle]);

  useEffect(() => {
    if (loading) return;
    if (pathname !== "/" && pathname !== "/admin") {
      navigate("/", { replace: true });
      return;
    }
    if (isAdminRoute && !user?.isAdmin) {
      navigate("/", { replace: true });
    }
  }, [loading, pathname, isAdminRoute, user, navigate]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    if (!query) return products;

    return products.filter(
      (product) =>
        product.name.toLocaleLowerCase().includes(query) ||
        (product.description ?? "").toLocaleLowerCase().includes(query),
    );
  }, [products, search]);

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

  async function handleSaveSiteSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const saved = await updateSiteSettings(siteSettingsForm);
      setSiteSettings(saved);
      setSiteSettingsForm(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save site settings.");
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
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>{siteSettings.headerText}</span>
        </a>

        <nav className="header-actions" aria-label="Account">
          {user ? (
            <>
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
      <section className="store-hero" id="home">
        <div className="hero-content">
          <p className="eyebrow">{siteSettings.headerText.toLocaleUpperCase()}</p>
          <h1>{siteSettings.heroTitle.split("\\n").map((line, index) => (
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
          <div className="hero-letter">L</div>
        </div>
      </section>

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
                <div className="product-art" aria-hidden="true">
                  <span className="product-art-letter">
                    {product.name.trim().charAt(0).toLocaleUpperCase()}
                  </span>
                  <span className="product-art-index">
                    {String(products.indexOf(product) + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="product-card-body">
                  <div className="product-card-heading">
                    <h3>{product.name}</h3>
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
              <div className="form-actions">
                <button type="submit" className="button button-primary" disabled={submitting}>
                  {submitting ? "Saving…" : "Save storefront content"}
                </button>
              </div>
            </form>
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
              <div className="form-actions">
                <button type="submit" className="button button-primary" disabled={submitting}>
                  {submitting ? "Saving…" : "Save storefront content"}
                </button>
              </div>
            </form>
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
          <span className="brand-mark" aria-hidden="true">L</span>
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
            <h2 id="login-title">Sign in to Ledger</h2>
            <p className="muted">
              Sign in to access your account.
            </p>

            <form onSubmit={handleLogin}>
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
                  autoComplete="current-password"
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
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
