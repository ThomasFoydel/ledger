import { Link } from "react-router-dom";

type SiteFooterProps = {
  siteSettings: {
    headerText: string;
    logoUrl: string | null;
    pageTitle: string;
    footerText: string;
  };
};

export default function SiteFooter({ siteSettings }: SiteFooterProps) {
  return (
    <footer className="site-footer">
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
    </footer>
  );
}
