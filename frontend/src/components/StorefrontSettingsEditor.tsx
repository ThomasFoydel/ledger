import type { ChangeEvent, FormEvent } from "react";
import type { SiteSettings } from "../api";

type StorefrontSettingsEditorProps = {
  form: SiteSettings;
  setForm: (value: SiteSettings) => void;
  currentSettings: SiteSettings;
  logoPreviewUrl: string | null;
  faviconPreviewUrl: string | null;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSelectLogo: (file: File | undefined) => void;
  onSelectFavicon: (file: File | undefined) => void;
  onRemoveLogo: () => void | Promise<void>;
  onRemoveFavicon: () => void | Promise<void>;
};

export default function StorefrontSettingsEditor({
  form,
  setForm,
  currentSettings,
  logoPreviewUrl,
  faviconPreviewUrl,
  submitting,
  onSubmit,
  onSelectLogo,
  onSelectFavicon,
  onRemoveLogo,
  onRemoveFavicon,
}: StorefrontSettingsEditorProps) {
  const updateField = <K extends keyof SiteSettings>(
    field: K,
    value: SiteSettings[K],
  ) => {
    setForm({ ...form, [field]: value });
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    onSelect: (file: File | undefined) => void,
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    onSelect(file);
  };

  return (
    <div className="admin-card">
      <h3>Storefront content</h3>
      <form className="product-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="site-page-title">Browser page title</label>
          <input
            id="site-page-title"
            required
            maxLength={200}
            value={form.pageTitle}
            onChange={event => updateField("pageTitle", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="site-header-text">Header / store name</label>
          <input
            id="site-header-text"
            required
            maxLength={200}
            value={form.headerText}
            onChange={event => updateField("headerText", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="site-hero-title">Main heading (use a new line for a line break)</label>
          <textarea
            id="site-hero-title"
            required
            maxLength={500}
            rows={2}
            value={form.heroTitle}
            onChange={event => updateField("heroTitle", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="site-hero-description">Page description</label>
          <textarea
            id="site-hero-description"
            required
            maxLength={2000}
            rows={3}
            value={form.heroDescription}
            onChange={event => updateField("heroDescription", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="site-footer-text">Footer text</label>
          <input
            id="site-footer-text"
            required
            maxLength={500}
            value={form.footerText}
            onChange={event => updateField("footerText", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="site-favicon">Browser favicon (PNG, JPEG, or WebP; max 2 MB)</label>
          {(faviconPreviewUrl || currentSettings.faviconUrl) && (
            <div className="logo-preview">
              <img
                className="favicon-preview-image"
                src={faviconPreviewUrl ?? currentSettings.faviconUrl ?? ""}
                alt={faviconPreviewUrl ? "Selected favicon preview" : "Current favicon"}
              />
              <button
                type="button"
                className="text-button text-button-danger"
                onClick={() => void onRemoveFavicon()}
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
            onChange={event => handleFileChange(event, onSelectFavicon)}
          />
        </div>
        <div className="field">
          <label htmlFor="site-logo">Store logo (PNG, JPEG, or WebP; max 2 MB)</label>
          {(logoPreviewUrl || currentSettings.logoUrl) && (
            <div className="logo-preview">
              <img
                src={logoPreviewUrl ?? currentSettings.logoUrl ?? ""}
                alt={logoPreviewUrl ? "Selected store logo preview" : "Current store logo"}
              />
              <button
                type="button"
                className="text-button text-button-danger"
                onClick={() => void onRemoveLogo()}
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
            onChange={event => handleFileChange(event, onSelectLogo)}
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save storefront content"}
          </button>
        </div>
      </form>
    </div>
  );
}
