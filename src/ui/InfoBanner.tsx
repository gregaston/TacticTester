import type { ReactNode } from "react";
import "./info-banner.css";

type InfoBannerProps = {
  children: ReactNode;
};

export function InfoBanner({ children }: InfoBannerProps) {
  return (
    <aside className="info-banner">
      <svg className="info-banner-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 11.2v5.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="7.6" r="1.15" fill="currentColor" />
      </svg>
      <p>{children}</p>
    </aside>
  );
}
