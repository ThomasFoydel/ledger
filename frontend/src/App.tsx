import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "./api";
import "./App.css";

const emptyProduct: ProductInput = {
  name: "",
  description: "",
  price: 0,
  quantityOnHand: 0,
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<ProductInput>(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    if (!query) return products;

    return products.filter(
      (product) =>
        product.name.toLocaleLowerCase().includes(query) ||
        (product.description ?? "").toLocaleLowerCase().includes(query),
    );
  }, [products, search]);

  const loadProducts = useCallback(async () => {
    setProducts(await getProducts());
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const currentUser = await getCurrentUser();
        if (!active) return;

        setUser(currentUser);

        if (currentUser) {
          const items = await getProducts();
          if (active) setProducts(items);
        }
      } catch {
        if (active) {
          setError("Unable to load Ledger. Check that the API is running.");
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

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser) await loadProducts();
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
      setProducts([]);
      setSearch("");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign out.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm(emptyProduct);
    setEditingId(null);
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
      <main className="app-shell">
        <p>Loading Ledger…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="app-shell">
        <section className="auth-card">
          <h1>Ledger</h1>
          <p>Sign in to manage your inventory.</p>

          <form onSubmit={handleLogin}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Ledger</h1>
          <p>Inventory management</p>
        </div>

        <div className="account-actions">
          <span>Signed in as {user.email}</span>
          <button
            type="button"
            className="secondary-button"
            onClick={handleLogout}
            disabled={submitting}
          >
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      <section className="product-editor">
        <h2>{editingId ? "Edit product" : "Add product"}</h2>

        <form onSubmit={handleSaveProduct}>
          <label htmlFor="product-name">Name</label>
          <input
            id="product-name"
            required
            maxLength={200}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />

          <label htmlFor="product-description">Description</label>
          <textarea
            id="product-description"
            maxLength={2000}
            rows={3}
            value={form.description ?? ""}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />

          <label htmlFor="product-price">Price</label>
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

          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Create product"}
            </button>

            {editingId && (
              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
                disabled={submitting}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="product-list">
        <div className="section-heading">
          <h2>Products</h2>
          <span>
            {filteredProducts.length} of {products.length}{" "}
            {products.length === 1 ? "product" : "products"}
          </span>
        </div>

        <label htmlFor="product-search">Search products</label>
        <input
          id="product-search"
          type="search"
          placeholder="Search by name or description…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {products.length === 0 ? (
          <p className="empty-state">
            No products yet. Add your first product above.
          </p>
        ) : filteredProducts.length === 0 ? (
          <p className="empty-state">
            No products match “{search}”. Try another search.
          </p>
        ) : (
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-card-heading">
                  <h3>{product.name}</h3>
                  <strong>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(product.price)}
                  </strong>
                </div>

                <p className="product-description">
                  {product.description || "No description provided."}
                </p>

                <p>
                  <strong>In stock:</strong> {product.quantityOnHand}
                </p>

                <div className="product-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => startEditing(product)}
                    disabled={submitting}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void handleDeleteProduct(product)}
                    disabled={submitting}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
