# UI Product Direction

Status: implementation and QA guidance  
Companion: [product-spec.md](product-spec.md)  

This records UI, PWA, and brand guidance for the current `apps/web` React shell.
Treat it as QA guidance, not proof of live encrypted delivery.

## Product Stance

Agent Notifier opens as a working app. New devices land in setup; paired
devices land in inbox. Do not ship a marketing-only first screen.

The product should feel like a quiet operational tool: focused, sparse,
trustworthy, and fast to scan. Use Resend's design source as influence for
crisp typography, restrained surfaces, polished empty states, and careful
operational copy, but do not copy Resend branding.

Do not add remote control, multi-turn chat, server-readable message content,
server-visible plaintext hashes, or v1 self-hosting docs.

## Brand And Logo

Keep **Agent Notifier** as the working product name until domain and legal
review. Use `agent-notifier` for URLs, packages, and CLI names.

Use a simple envelope-lock mark that can become CSS or SVG:

- Rounded rectangle envelope body.
- Centered lock notch or shackle.
- Single flap line.
- Monochrome by default.
- Accent color only for active, focus, or installation states.
- 16px and 24px variants with optical centering.

Avoid mascots, chat bubbles, robot marks, and "AI sparkle" decoration. This is
a secure delivery and consent channel, not an agent companion.

## Visual System

Visual thesis: monochrome workspace, one restrained accent, typography-led
hierarchy, and product copy that tells the user exactly what is happening.

| Role | Light | Dark | Notes |
| --- | --- | --- | --- |
| Background | `#FAFAFA` | `#0A0A0A` | App canvas |
| Surface | `#FFFFFF` | `#141414` | Lists, panels, dialogs |
| Border | `#E5E5E5` | `#262626` | 1px dividers |
| Text primary | `#171717` | `#FAFAFA` | Body and titles |
| Text secondary | `#737373` | `#A3A3A3` | Meta and hints |
| Accent | `#2563EB` | `#3B82F6` | Primary actions and focus |
| Success | `#16A34A` | `#22C55E` | Delivered and approved |
| Warning | `#CA8A04` | `#EAB308` | Push degraded and expiry |
| Danger | `#DC2626` | `#EF4444` | Delete and revoke |

Sensitive or hidden previews use neutral styling: lock icon plus "Hidden preview".

Typography:

- UI stack: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.
- Monospace for pairing codes and IDs:
  `ui-monospace, "SF Mono", Consolas, monospace`.
- Mobile base: 16px. Page title: 20px semibold.
- List title: 15px medium. Body: 15px regular. Meta: 13px.
- Button: 14px medium.

Overflow rules: `truncate` row titles, `line-clamp-2` previews,
`break-words` detail/legal text, and `min-w-0` on flex children.

## App Shell

Mobile:

- Top bar with current section title and overflow menu.
- Primary workspace fills the screen.
- Bottom nav: Inbox, Saved, Senders, Settings.
- Message detail opens as a full-screen pushed view.

Desktop:

- Left rail with wordmark and nav.
- Main workspace uses master-detail when possible.
- Inbox list and message detail can sit side by side.
- Setup and legal pages use readable centered widths.

Use cards only for interactive clusters such as pairing approval, push
troubleshooting steps, and destructive confirmations. Inbox items are rows on a
surface, not one card per item.

## Motion And Interaction

- 150ms transitions for hover and focus states.
- 200ms panel transitions for mobile detail screens.
- Honor `prefers-reduced-motion` with opacity-only alternatives.
- Use skeleton rows for inbox loading.
- Put toasts at the bottom on mobile and bottom-right on desktop.
- Make focus rings visible on every interactive element.
- Support future mobile swipe actions: one direction saves, the other deletes.
- Keep explicit save/delete icon buttons on desktop and keyboard paths.

## Entry Routing

| Local state | Route | Screen |
| --- | --- | --- |
| No device keys | `/` or `/setup` | Setup hub |
| Keys and setup in progress | `/setup/...` | Resume pairing |
| Keys and at least one sender | `/inbox` | Inbox |

Deep setup links must work directly. Never route through a standalone marketing
hero before setup or inbox.

## Screen Guidance

Setup hub:

- Title: "Set up this device".
- Explain in three short lines: paired agents can notify you, contents are
  encrypted, and inbox history stays on this device.
- Primary action: "Pair an agent".
- Secondary action: "Waiting for a setup email?"
- Footer links: Privacy, Security, Terms.

Email pairing:

- Three steps: Device, Notifications, Approve sender.
- Show sender display name before approval.
- Explain email is for setup links and recovery, not a server-readable inbox.
- Approval panel lists notify, request reply, and request approval capability.
- Actions: Approve and Reject.

Pairing code:

- Large monospace code such as `ABCD-1234`.
- Expiry countdown and copy button.
- Encourage email recovery, but allow explicit skip.
- Claimed sessions reuse the sender approval panel.

Inbox:

- Search local decrypted content.
- Filters: All and Needs action.
- Row content: sender, mode icon, title, preview or "Hidden preview", time,
  saved state, and pending indicator.
- Empty state: "No notifications yet" plus one sentence about opening the app
  to fetch messages when push is off.

Message detail:

- Show title, body, sender, received time, and mode badge.
- Notify mode: Save and Delete.
- Reply request: short textarea, Send reply, Dismiss.
- Approval request: action label, Approve, Reject, optional note.
- Expired requests are read-only.
- Include one tertiary line explaining why preview was shown or hidden.

Saved:

- Reuse the inbox list pattern.
- Empty copy: "No saved messages" plus one sentence about auto-delete.

Senders:

- Rows show display name, kind, last used, and status.
- Sender settings include display name, capabilities, preview policy,
  rate-limit profile placeholder, revoke confirmation, and filtered messages.

Settings:

- Grouped list rows for Notifications, Preview policy, Local retention, Email
  and recovery, This device, and Legal.

Terms, Privacy, Security:

- Use readable prose, `max-w-prose`, and app chrome.
- Security includes an explicit metadata table.

## PWA And Push States

| State | UI treatment | Copy direction |
| --- | --- | --- |
| `unsupported` | Info banner | Browser cannot receive push notifications. |
| `default` | CTA | Notifications are off. |
| `granted` and subscribed | Success chip | Notifications are on. |
| `granted` without subscription | Warning | Permission is on, but this device is not registered. |
| `denied` | Warning with steps | Notifications are blocked. |
| `ios_not_installed` | Warning | Add to Home Screen for reliable iPhone notifications. |
| `paired_no_push` | Inbox banner | Connected, but messages arrive when the app opens. |
| `service_worker_error` | Error | Background delivery is unavailable. |

Pairing can still complete when push is denied or unsupported. Keep degraded
status clear and make open-app fetch obvious.

iOS install guidance should stay collapsed and short:

1. Tap Share.
2. Add to Home Screen.
3. Open from Home Screen.
4. Enable notifications when prompted.

## Privacy Copy Rules

Approved promises:

- "Message contents are end-to-end encrypted."
- "We cannot read titles, bodies, replies, or approval details."
- "We temporarily store encrypted envelopes so your devices can receive them."
- "Your inbox history lives on this device."
- "We see account and delivery metadata, such as email, sender and device IDs,
  timestamps, queue state, delivery state, and push subscription metadata."

Never claim:

- "We store no data."
- "We hide all metadata."
- "Anonymous."
- "Encrypted cloud inbox."
- "We cannot see who sent what."

Recurring copy:

- Setup: "Only your devices can decrypt notifications."
- Email: "Used for setup links and recovery. Not used to read your messages."
- Lost phone: "Messages on a lost device are not recoverable from the server."
- Hidden preview: "Preview hidden on this device. Open the app to read."
- Revoke: "The agent can no longer send through Agent Notifier. Local agent
  files may still exist on its machine."
- Approval: "Agent Notifier sends your signed choice back to the agent. It does
  not run the action."

## Tailwind, Base UI, Heroicons

Tailwind:

- Enable dark mode from day one.
- Use semantic CSS variables mapped into Tailwind tokens.
- Use safe-area padding for the mobile bottom nav.
- Add stable dimensions for nav buttons, icon buttons, rows, and pairing codes.

Base UI:

- Dialog for revoke and delete confirmations.
- Menu for row overflow actions.
- Switch for permission toggles.
- Select for retention and preview policy.
- Toast for copy, delivery, and error feedback.

Heroicons:

- `InboxIcon`: Inbox.
- `BookmarkIcon`: Saved and save action.
- `CommandLineIcon` or `CpuChipIcon`: Senders.
- `Cog6ToothIcon`: Settings.
- `BellIcon`: notify mode.
- `ChatBubbleLeftEllipsisIcon`: reply request.
- `HandThumbUpIcon`: approval request.
- `LockClosedIcon`: hidden preview.
- `ClockIcon`: pending or expiring.
- `TrashIcon`: delete.
- `MagnifyingGlassIcon`: search.
- `ExclamationTriangleIcon`: degraded push state.
- `CheckCircleIcon`: success.

Icons must not be the only mode indicator. Use labels or accessible names.

## QA Checklist

Capture mobile `390x844` and desktop `1280x800` in light and dark mode before
public launch.

- Fresh install opens setup, not a marketing page.
- Paired device opens inbox.
- Setup email deep link loads the pairing flow.
- Mobile bottom nav and desktop left nav are consistent.
- No horizontal scroll with long titles, sender names, or message bodies.
- Code flow shows expiry countdown and copy action.
- Email pairing shows sender name before approval.
- Push denied path still completes pairing with degraded status.
- Empty inbox renders.
- Notify, reply, and approval rows are visually distinct.
- Needs action filter catches pending reply and approval messages.
- Local search finds decrypted content.
- Save and delete work with mobile and desktop controls.
- Reply and approval submit states are clear.
- Expired requests are read-only.
- Sensitive messages show hidden preview when policy requires it.
- Global and sender preview policies change future preview behavior.
- Sender revoke requires confirmation.
- Push troubleshooting exposes all states listed above.
- Terms, Privacy, and Security are linked from setup and settings.
- Security page includes a metadata table.
- Keyboard navigation reaches nav, rows, detail actions, and dialogs.
- Focus rings are visible.
- `prefers-reduced-motion` is honored.

## Open Decisions

- Final name, domain, app/marketing origin split, accent color, exact iOS PWA
  copy after device QA, desktop split-view breakpoint, and live setup/push copy
  after the deployed API is connected.
