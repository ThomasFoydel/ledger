import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Product, SiteSettings, User } from "../api";
import AdminOrderList from "./AdminOrderList";
import AdminProductList from "./AdminProductList";
import ProductEditor from "./ProductEditor";
import StorefrontSettingsEditor from "./StorefrontSettingsEditor";
import { useAdminManagement } from "../hooks/useAdminManagement";
import { useProductManagement } from "../hooks/useProductManagement";
import { useSiteSettings } from "../hooks/useSiteSettings";

type AdminPageProps = {
  loading: boolean;
  user: User | null;
  routes: {
    isAdminProductsRoute: boolean;
    isAdminOrdersRoute: boolean;
    isAdminStorefrontRoute: boolean;
  };
  storefront: {
    products: Product[];
    setProducts: Dispatch<SetStateAction<Product[]>>;
    loadProducts: () => Promise<void>;
    siteSettings: SiteSettings;
    setSiteSettings: (settings: SiteSettings) => void;
  };
  shared: {
    error: string;
    setError: Dispatch<SetStateAction<string>>;
    submitting: boolean;
    setSubmitting: Dispatch<SetStateAction<boolean>>;
    currency: Intl.NumberFormat;
    productImageVersion: number;
    onProductImageUpdated: () => void;
  };
};

type AdminNavigationState = {
  editProduct?: Product;
  deleteProduct?: Product;
};

export default function AdminPage({
  loading,
  user,
  routes,
  storefront,
  shared,
}: AdminPageProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const admin = useAdminManagement({
    loading,
    isAdminProductsRoute: routes.isAdminProductsRoute,
    isAdminOrdersRoute: routes.isAdminOrdersRoute,
    user,
    loadProducts: storefront.loadProducts,
  });

  const settings = useSiteSettings({
    siteSettings: storefront.siteSettings,
    setSiteSettings: storefront.setSiteSettings,
    setError: shared.setError,
    setSubmitting: shared.setSubmitting,
  });

  const productManagement = useProductManagement({
    isAdminProductsRoute: routes.isAdminProductsRoute,
    navigate,
    setProducts: storefront.setProducts,
    setError: shared.setError,
    setSubmitting: shared.setSubmitting,
    loadProducts: storefront.loadProducts,
    loadAdminProducts: admin.products.load,
    onProductImageUpdated: shared.onProductImageUpdated,
  });

  const editingProduct = storefront.products.find(
    (product) => product.id === productManagement.editingId,
  );
  const { startEditing, handleDeleteProduct } = productManagement;

  useEffect(() => {
    const state = location.state as AdminNavigationState | null;

    if (!state?.editProduct && !state?.deleteProduct) return;

    navigate(location.pathname, { replace: true, state: null });

    if (state.editProduct) {
      void startEditing(state.editProduct);
    }

    if (state.deleteProduct) {
      void handleDeleteProduct(state.deleteProduct);
    }
  }, [
    location.key,
    location.pathname,
    location.state,
    navigate,
    startEditing,
    handleDeleteProduct,
  ]);

  const isAdminOrdersRoute = routes.isAdminOrdersRoute;
  const isAdminProductsRoute = routes.isAdminProductsRoute;
  const isAdminStorefrontRoute = routes.isAdminStorefrontRoute;

  return (
    <section className="admin-section" id="admin-panel">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">STORE MANAGEMENT</p>
          <h2>
            {isAdminOrdersRoute
              ? "Order management"
              : isAdminStorefrontRoute
                ? "Storefront content"
                : "Product management"}
          </h2>
          <a href="/">Back to storefront</a>
          <nav className="admin-nav" aria-label="Admin navigation">
            <Link
              className="admin-nav-link"
              to="/admin/orders"
              aria-current={isAdminOrdersRoute ? "page" : undefined}
            >
              Orders
            </Link>
            <Link
              className="admin-nav-link"
              to="/admin/products"
              aria-current={isAdminProductsRoute ? "page" : undefined}
            >
              Products
            </Link>
            <Link
              className="admin-nav-link"
              to="/admin/storefront"
              aria-current={isAdminStorefrontRoute ? "page" : undefined}
            >
              Storefront
            </Link>
          </nav>
          <p className="muted">
            {isAdminOrdersRoute
              ? "Review orders, manage fulfillment, and track shipments."
              : isAdminStorefrontRoute
                ? "Update your store identity, page content, logo, and favicon."
                : "Manage your product catalog and inventory."}
          </p>
        </div>
        <span className="admin-badge">Owner access</span>
      </div>

      {isAdminOrdersRoute && (
        <AdminOrderList
          orders={admin.orders.items}
          loading={admin.orders.isLoading}
          error={admin.orders.error}
          totalCount={admin.orders.totalCount}
          totalPages={admin.orders.totalPages}
          search={admin.orders.search}
          setSearch={admin.orders.setSearch}
          archiveFilter={admin.orders.archiveFilter}
          setArchiveFilter={admin.orders.setArchiveFilter}
          page={admin.orders.page}
          setPage={admin.orders.setPage}
          actionId={admin.orders.actionId}
          currency={shared.currency}
          onRefresh={admin.orders.load}
          onToggleArchived={admin.orders.toggleArchived}
        />
      )}

      {isAdminStorefrontRoute && (
        <StorefrontSettingsEditor
          form={settings.siteSettingsForm}
          setForm={settings.setSiteSettingsForm}
          currentSettings={storefront.siteSettings}
          logoPreviewUrl={settings.logoPreviewUrl}
          faviconPreviewUrl={settings.faviconPreviewUrl}
          submitting={shared.submitting}
          onSubmit={settings.handleSaveSiteSettings}
          onSelectLogo={settings.handleSelectLogo}
          onSelectFavicon={settings.handleSelectFavicon}
          onRemoveLogo={settings.handleRemoveLogo}
          onRemoveFavicon={settings.handleRemoveFavicon}
        />
      )}

      {isAdminProductsRoute && (
        <>
          <ProductEditor
            form={productManagement.form}
            setForm={productManagement.setForm}
            priceDraft={productManagement.priceDraft}
            setPriceDraft={productManagement.setPriceDraft}
            quantityDraft={productManagement.quantityDraft}
            setQuantityDraft={productManagement.setQuantityDraft}
            editingId={productManagement.editingId}
            editingProduct={editingProduct}
            productImagePreviewUrl={productManagement.productImagePreviewUrl}
            productImageVersion={shared.productImageVersion}
            submitting={shared.submitting}
            error={shared.error}
            onSubmit={productManagement.handleSaveProduct}
            onSelectImage={productManagement.handleSelectProductImage}
            onCancel={productManagement.resetForm}
          />
          <AdminProductList
            products={admin.products.items}
            loading={admin.products.isLoading}
            error={admin.products.error}
            totalCount={admin.products.totalCount}
            totalPages={admin.products.totalPages}
            search={admin.products.search}
            setSearch={admin.products.setSearch}
            visibility={admin.products.visibility}
            setVisibility={admin.products.setVisibility}
            page={admin.products.page}
            setPage={admin.products.setPage}
            actionId={admin.products.actionId}
            submitting={shared.submitting}
            currency={shared.currency}
            onRefresh={admin.products.load}
            onEdit={productManagement.startEditing}
            onToggleVisibility={admin.products.toggleVisibility}
            onDelete={productManagement.handleDeleteProduct}
          />
        </>
      )}
    </section>
  );
}
