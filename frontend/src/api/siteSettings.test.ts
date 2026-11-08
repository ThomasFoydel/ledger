import { describe, expect, it } from "vitest";
import { resolveSiteSettingsImageUrl } from "./siteSettings";

describe("resolveSiteSettingsImageUrl", () => {
  const apiOrigin = "https://api.example.com";

  it("resolves stored API paths against the API origin", () => {
    expect(
      resolveSiteSettingsImageUrl(
        "/api/site-settings/logo",
        apiOrigin,
      ),
    ).toBe(`${apiOrigin}/site-settings/logo`);
  });

  it("resolves favicon paths against the API origin", () => {
    expect(
      resolveSiteSettingsImageUrl(
        "/api/site-settings/favicon",
        apiOrigin,
      ),
    ).toBe(`${apiOrigin}/site-settings/favicon`);
  });

  it("preserves the local development API proxy prefix", () => {
    expect(
      resolveSiteSettingsImageUrl("/api/site-settings/logo", "/api"),
    ).toBe("/api/site-settings/logo");
  });

  it("supports paths that do not contain the stored API prefix", () => {
    expect(
      resolveSiteSettingsImageUrl(
        "/site-settings/logo",
        apiOrigin,
      ),
    ).toBe(`${apiOrigin}/site-settings/logo`);
  });

  it("preserves already absolute URLs", () => {
    const url = "https://cdn.example.com/logo.png";

    expect(resolveSiteSettingsImageUrl(url, apiOrigin)).toBe(url);
  });

  it("preserves null image URLs", () => {
    expect(resolveSiteSettingsImageUrl(null, apiOrigin)).toBeNull();
  });
});
