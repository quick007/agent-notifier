import { SiteFooter } from "../components/SiteFooter";
import type { Route } from "../types";

type LegalRoute = "/privacy" | "/security" | "/terms";
type LegalContent = { title: string; body: string[]; table?: string[][] };

const content: Record<LegalRoute, LegalContent> = {
  "/privacy": {
    title: "Privacy",
    body: [
      "Message contents are end-to-end encrypted. We cannot read titles, bodies, replies, or approval details.",
      "We temporarily store encrypted envelopes so your devices can receive them. Your readable inbox history lives on this device.",
      "Email is used for setup links, recovery, and security messages. It is not a server-readable cloud inbox."
    ],
    table: [
      ["Email", "Setup, recovery, and security messages."],
      ["Sender and device IDs", "Routing, revocation, and abuse prevention."],
      ["Timestamps and delivery state", "Queue operation and sender-visible status."],
      ["Push subscription metadata", "Browser push delivery and troubleshooting."]
    ]
  },
  "/security": {
    title: "Security",
    body: [
      "The PWA owns device keys and decrypts messages locally. App-origin XSS is treated as a crypto boundary.",
      "Approval and reply responses should be encrypted to the sender and signed by this device.",
      "Agent Notifier returns signed human intent. It does not run actions for the agent.",
      "Report suspected vulnerabilities to agent-notify@seufert.sh. Include affected routes or components, impact, and reproduction steps when possible."
    ],
    table: [
      ["Content", "Encrypted before it reaches the service."],
      ["Metadata", "Visible to operate delivery and prevent abuse."],
      ["Retention", "Encrypted server queue expires after the product TTL."],
      ["Revocation", "Revoked senders should be rejected server-side."]
    ]
  },
  "/terms": {
    title: "Terms",
    body: [
      "Agent Notifier is a lightweight encrypted notification and approval channel for agents.",
      "Do not use it for routine progress spam, remote control, attachments, or multi-turn chat.",
      "Approval messages communicate your signed choice back to the sender. The service does not execute the underlying action."
    ]
  }
};

export function LegalPage({ route }: { route: Route }) {
  const page = isLegalRoute(route) ? content[route] : content["/privacy"];

  return (
    <article className="an-rise mx-auto w-full max-w-2xl px-4 py-5 md:px-8 md:py-8">
      <h1 className="text-xl font-semibold tracking-tight">{page.title}</h1>
      <div className="mt-5 space-y-4 text-[15px] leading-7 text-neutral-700 dark:text-neutral-300">
        {page.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {page.table && (
        <div className="mt-7 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-900">
          <table className="w-full border-collapse bg-white text-left text-sm dark:bg-neutral-950">
            <tbody>
              {page.table.map(([label, value]) => (
                <tr className="border-b border-neutral-200 last:border-0 dark:border-neutral-900" key={label}>
                  <th className="w-32 px-4 py-3 font-medium text-neutral-950 dark:text-neutral-50">
                    {label}
                  </th>
                  <td className="px-4 py-3 leading-6 text-neutral-600 dark:text-neutral-300">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SiteFooter className="mt-8" />
    </article>
  );
}

function isLegalRoute(route: Route): route is LegalRoute {
  return route === "/privacy" || route === "/security" || route === "/terms";
}
