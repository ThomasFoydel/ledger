import type { RefObject } from "react";
import { Link } from "react-router-dom";
import type { SiteSettings, User } from "../api";

type SiteHeaderProps = {
  siteSettings: SiteSettings;
  user: User | null;
  isAdminRoute: boolean;
  cartTriggerRef: RefObject<HTMLButtonElement | null>;
  cartItemCount: number;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  submitting: boolean;
  onLogout: () => void;
  onSignIn: () => void;
};

export default function SiteHeader({
  siteSettings,
  user,
  isAdminRoute,
  cartTriggerRef,
  cartItemCount,
  cartDrawerOpen,
  setCartDrawerOpen,
  submitting,
  onLogout,
  onSignIn,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label={`${siteSettings.headerText} home`}>
        {siteSettings.logoUrl ? (
          <img className="brand-logo" src={siteSettings.logoUrl} alt="" />
        ) : (
          <span className="brand-mark" aria-hidden="true">
            {siteSettings.pageTitle.trim().charAt(0).toLocaleUpperCase() || "L"}
          </span>
        )}
        <span>{siteSettings.headerText}</span>
      </Link>

      <nav className="header-actions" aria-label="Account">
        {!isAdminRoute && (
          <button
            ref={cartTriggerRef}
            type="button"
            className="cart-nav-link cart-trigger"
            onClick={() => setCartDrawerOpen(true)}
            aria-label={`Open shopping cart, ${cartItemCount} items`}
            aria-haspopup="dialog"
            aria-expanded={cartDrawerOpen}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 3h2l2.2 11.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.4L22 8H6" />
              <circle cx="10" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            <span>Cart</span>
            <span className="cart-count-badge">{cartItemCount}</span>
          </button>
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
              onClick={onLogout}
              disabled={submitting}
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button button-primary"
            onClick={onSignIn}
          >
            Sign in
          </button>
        )}
      </nav>
    </header>
  );
}
