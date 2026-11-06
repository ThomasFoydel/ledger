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

export async function getSiteSettings(): Promise<SiteSettings> {
  const response = await fetch(`${API_PREFIX}/site-settings`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not load site settings.");
  return response.json() as Promise<SiteSettings>;
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
  return response.json() as Promise<SiteSettings>;
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

  return response.json() as Promise<SiteSettings>;
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

  return response.json() as Promise<SiteSettings>;
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
  return response.json() as Promise<SiteSettings>;
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
  return response.json() as Promise<SiteSettings>;
}
