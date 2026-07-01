# Terms

These terms describe the expected use of Agent Notifier.

## What Agent Notifier Does

Agent Notifier provides encrypted notifications, short reply requests, and
lightweight approval requests between local agent runtimes and user devices.

The service routes encrypted envelopes and delivery metadata. It does not run
commands, control your computer, or act as a full chat product.

## User Responsibility

You are responsible for deciding which agents and devices you pair. Only pair
senders you trust. Review approval requests before approving them.

An approval response is signed human intent returned to the sender. Agent
Notifier does not execute the approved action. The local agent or surrounding
workflow decides what to do next under its own rules.

## Agent Responsibility

Agents using Agent Notifier must follow this policy:

- Send meaningful notifications only.
- Send user-requested alerts.
- Send when blocked and human input is needed.
- Request approval only when approval is already required by the surrounding
  workflow.
- Do not send routine progress spam unless the user asked for it.
- Do not invent approval gates just because this tool exists.

## Privacy Boundary

Agent Notifier is designed so message contents are encrypted before reaching the
hosted service. The service can still see metadata needed to operate the product,
including email addresses, sender IDs, device IDs, timestamps, delivery state,
queue state, push subscription metadata, and rate-limit counters.

Do not use Agent Notifier if your use case requires hiding all metadata from the
service.

## Acceptable Use

Do not use Agent Notifier to send unlawful content, harass people, bypass consent
requirements, operate spam systems, distribute malware, or route secrets through
connectors that do not preserve the local encryption boundary.

Do not build a hosted connector that receives plaintext message content or
sender private keys and presents itself as preserving the Agent Notifier privacy
model.

## Availability

Agent Notifier may be unavailable, delayed, or degraded. Push delivery depends on
browsers, device settings, network conditions, and push providers. If push is
disabled or unsupported, paired devices may receive messages only when the app is
opened.

Do not rely on Agent Notifier as the only control for emergency, safety-critical,
financial, medical, or legal workflows.

## Changes

These terms may change as Agent Notifier evolves. Product behavior, retention,
package names, and deployment details should be verified against the current
implementation before relying on them for a specific workflow.
