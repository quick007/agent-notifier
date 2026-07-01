import { cn } from "./ui";

type FooterLink = { label: string; href: string; external?: boolean };

const links: FooterLink[] = [
  { label: "Privacy", href: "#/privacy" },
  { label: "Security", href: "#/security" },
  { label: "Terms", href: "#/terms" },
  { label: "API reference", href: "/docs", external: true }
];

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-500 dark:text-neutral-400",
        className
      )}
    >
      {links.map((link) => (
        <a
          className="rounded transition hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:hover:text-neutral-50 dark:focus:ring-blue-400"
          href={link.href}
          key={link.href}
          {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {link.label}
        </a>
      ))}
    </footer>
  );
}
