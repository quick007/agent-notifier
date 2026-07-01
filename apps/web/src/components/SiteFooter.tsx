import { Link } from "react-router-dom";

import { DOCS_URL, GITHUB_URL, LICENSE_URL } from "../lib/links";
import { cn } from "./ui";

type FooterLink = { label: string; to: string; external?: boolean };

const links: FooterLink[] = [
  { label: "Privacy", to: "/privacy" },
  { label: "Security", to: "/security" },
  { label: "Terms", to: "/terms" },
  { label: "MIT License", to: LICENSE_URL, external: true },
  { label: "API reference", to: DOCS_URL, external: true },
  { label: "GitHub", to: GITHUB_URL, external: true }
];

const linkClass =
  "rounded transition hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:hover:text-neutral-50 dark:focus:ring-blue-400";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-500 dark:text-neutral-400",
        className
      )}
    >
      {links.map((link) =>
        link.external ? (
          <a
            className={linkClass}
            href={link.to}
            key={link.to}
            rel="noreferrer"
            target="_blank"
          >
            {link.label}
          </a>
        ) : (
          <Link className={linkClass} key={link.to} to={link.to}>
            {link.label}
          </Link>
        )
      )}
    </footer>
  );
}
