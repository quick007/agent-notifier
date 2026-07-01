import {
  BookmarkIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  InboxIcon
} from "@heroicons/react/24/outline";
import type { ReactNode } from "react";

import { href } from "../lib/routes";
import type { Route } from "../types";
import { Wordmark } from "./Brand";
import { cn } from "./ui";

const navItems: Array<{
  label: string;
  route: Route;
  icon: typeof InboxIcon;
}> = [
  { label: "Inbox", route: "/inbox", icon: InboxIcon },
  { label: "Saved", route: "/saved", icon: BookmarkIcon },
  { label: "Senders", route: "/senders", icon: CommandLineIcon },
  { label: "Settings", route: "/settings", icon: Cog6ToothIcon }
];

export function AppShell({
  route,
  children,
  title
}: {
  route: Route;
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r border-neutral-200 bg-white/80 px-4 py-4 dark:border-neutral-900 dark:bg-neutral-950/80 md:block">
          <Wordmark />
          <nav className="mt-8 grid gap-1" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink key={item.route} item={item} route={route} />
            ))}
          </nav>
          <p className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-3 text-xs leading-5 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
            Message contents stay encrypted on the server. This device owns the
            readable inbox.
          </p>
          <a
            className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50 dark:focus:ring-blue-400"
            href="/docs"
            rel="noreferrer"
            target="_blank"
          >
            <CodeBracketIcon className="h-4 w-4" />
            <span>API reference</span>
          </a>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur dark:border-neutral-900 dark:bg-neutral-950/90 md:hidden">
            <Wordmark />
            <span className="truncate text-sm font-medium">{title}</span>
          </header>
          <main className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>
        </div>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-neutral-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 md:hidden"
      >
        {navItems.map((item) => (
          <MobileNavLink key={item.route} item={item} route={route} />
        ))}
      </nav>
    </div>
  );
}

function NavLink({
  item,
  route
}: {
  item: (typeof navItems)[number];
  route: Route;
}) {
  const active = route === item.route || route.startsWith(`${item.route}/`);
  const Icon = item.icon;

  return (
    <a
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-blue-400 dark:focus:ring-offset-neutral-950",
        active
          ? "bg-neutral-950 text-white dark:bg-neutral-50 dark:text-neutral-950"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
      )}
      href={href(item.route)}
    >
      <Icon className="h-5 w-5" />
      <span>{item.label}</span>
    </a>
  );
}

function MobileNavLink({
  item,
  route
}: {
  item: (typeof navItems)[number];
  route: Route;
}) {
  const active = route === item.route || route.startsWith(`${item.route}/`);
  const Icon = item.icon;

  return (
    <a
      className={cn(
        "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-600",
        active
          ? "text-blue-600 dark:text-blue-400"
          : "text-neutral-500 dark:text-neutral-400"
      )}
      href={href(item.route)}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
      <span>{item.label}</span>
    </a>
  );
}
