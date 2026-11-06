import { API_PREFIX, getCsrfToken } from "./client";

export type SiteSettings = {
  pageTitle: string;
  headerText: string;
  heroTitle: string;
  heroDescription: string;
  footerText: string;
  logoUrl: string | null;
  faviconUrl: string | null;
};

export function resolveSiteSettingsImageUrl(
  url: string | null,
  apiPrefix = API_PREFIX,
): string | null {
  if (
    !url ||
    /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(url) ||
    /^(?:data|blob):/i.test(url)
  ) {
    return url;
  }

  const apiBase = apiPrefix.replace(/\/+$/, "");
  const apiPath = url.startsWith("/api/") ? url.slice(4) : url;

  return `${apiBase}${apiPath.startsWith("/") ? "" : "/"}${apiPath}`;
}

function normalizeSiteSettings(settings: SiteSettings): SiteSettings {
  return {
    ...settings,
    logoUrl: resolveSiteSettingsImageUrl(settings.logoUrl),
    faviconUrl: resolveSiteSettingsImageUrl(settings.faviconUrl),
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const response = await fetch(`${API_PREFIX}/site-settings`, {
    credentials: "include",
  });

  if (!response.ok) throw new Error("Could not load site settings.");

  return normalizeSiteSettings(await response.json() as SiteSettings);
}

export async function updateSiteSettings(
  settings: SiteSettings,
): Promise<SiteSettings> {
  const response = await fetch(`${API_PREFIX}/site-settings`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": await getCsrfToken(),
    },
    body: JSON.stringify(settings),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to edit site settings.");
  }

  if (!response.ok) throw new Error("Could not save site settings.");

  return normalizeSiteSettings(await response.json() as SiteSettings);
}

export async function uploadSiteLogo(file: File): Promise<SiteSettings> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_PREFIX}/site-settings/logo`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-TOKEN": await getCsrfToken() },
    body: formData,
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to upload a logo.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Could not upload logo.");
  }

  return normalizeSiteSettings(await response.json() as SiteSettings);
}

export async function deleteSiteLogo(): Promise<SiteSettings> {
  const response = await fetch(`${API_PREFIX}/site-settings/logo`, {
    method: "DELETE",
    credentials: "include",
    headers: { "X-CSRF-TOKEN": await getCsrfToken() },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to remove the logo.");
  }

  if (!response.ok) throw new Error("Could not remove logo.");

  return normalizeSiteSettings(await response.json() as SiteSettings);
}

export async function uploadSiteFavicon(file: File): Promise<SiteSettings> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_PREFIX}/site-settings/favicon`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-TOKEN": await getCsrfToken() },
    body: formData,
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to upload a favicon.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Could not upload favicon.");
  }

  return normalizeSiteSettings(await response.json() as SiteSettings);
}

export async function deleteSiteFavicon(): Promise<SiteSettings> {
  const response = await fetch(`${API_PREFIX}/site-settings/favicon`, {
    method: "DELETE",
    credentials: "include",
    headers: { "X-CSRF-TOKEN": await getCsrfToken() },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to remove the favicon.");
  }

  if (!response.ok) throw new Error("Could not remove favicon.");

  return normalizeSiteSettings(await response.json() as SiteSettings);
}
