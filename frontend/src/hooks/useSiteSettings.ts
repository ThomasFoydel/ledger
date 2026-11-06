import { useEffect, useState } from "react";
import {
  updateSiteSettings,
  uploadSiteLogo,
  deleteSiteLogo,
  uploadSiteFavicon,
  deleteSiteFavicon,
  type SiteSettings,
} from "../api";

type UseSiteSettingsOptions = {
  siteSettings: SiteSettings;
  setSiteSettings: (settings: SiteSettings) => void;
  setError: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
};

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

export function useSiteSettings({
  siteSettings,
  setSiteSettings,
  setError,
  setSubmitting,
}: UseSiteSettingsOptions) {
  const [siteSettingsForm, setSiteSettingsForm] =
    useState<SiteSettings>(siteSettings);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingFaviconFile, setPendingFaviconFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [faviconPreviewUrl, setFaviconPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

  useEffect(() => {
    return () => {
      if (faviconPreviewUrl) URL.revokeObjectURL(faviconPreviewUrl);
    };
  }, [faviconPreviewUrl]);

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

  async function handleSaveSiteSettings(
    event: React.FormEvent<HTMLFormElement>,
  ) {
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
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save storefront content.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return {
    siteSettingsForm,
    setSiteSettingsForm,
    logoPreviewUrl,
    faviconPreviewUrl,
    handleSaveSiteSettings,
    handleSelectLogo,
    handleSelectFavicon,
    handleRemoveLogo,
    handleRemoveFavicon,
  };
}
