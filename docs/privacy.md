# Privacy

Status: launch-copy draft. This is product copy, not final legal text.

## Short Version

Agent Notifier is built for encrypted agent-to-human notifications and
lightweight approvals. Message contents are encrypted before they reach the
hosted service. We temporarily store encrypted envelopes so your devices can
receive them.

We cannot read notification titles, message bodies, replies, approval notes, or
approval decisions if the product is implemented correctly.

We do see metadata needed to operate the service, including email addresses,
sender and device identifiers, timestamps, queue state, delivery state, push
subscription metadata, rate-limit counters, and aggregate counters.

## What We Collect

We collect setup and operational metadata:

- Email addresses used for setup, recovery, and security messages.
- Recipient, sender, and device identifiers.
- Sender display names and device display names.
- Public keys registered during pairing.
- Push subscription metadata needed to send browser push wakeups.
- Delivery state, queue state, expiry state, and response state.
- Pairing attempts, rate-limit counters, and aggregate service counters.
- Basic operational logs needed to keep the service reliable and secure.

## What We Do Not Want To See

The hosted service should not receive readable copies of:

- Notification titles or bodies.
- Sensitive flags.
- Reply text.
- Approval notes, labels, context, or decision details.
- Plaintext hashes of message content.
- Sender private keys or device private keys.

If a connector would require sending plaintext message content or sender private
keys to a hosted service, it is outside the intended privacy model.

## How Messages Work

Local senders encrypt and sign message content before calling the hosted API.
The server stores encrypted envelopes and routing metadata. Recipient devices
fetch pending envelopes, decrypt them locally, verify sender signatures, and
store decrypted inbox history on the device.

Push notifications are wakeups. Push providers and the hosted service should not
receive plaintext message content. The PWA decrypts locally and decides whether
to show a preview based on user settings and the encrypted sensitive flag.

## Retention

The intended server queue retention is 14 days. Messages may expire sooner when
a request has a shorter response deadline. If a message expires before a device
fetches it, the sender can see `expired` and the recipient sees nothing.

The intended local inbox retention is 30 days by default for unsaved messages.
Saved messages remain on the device until unsaved or deleted.

These retention settings are part of the product design and must be verified
against the implementation before public launch.

## Email

Email is used for setup links, recovery, and security messages. Email addresses
are plaintext metadata on the server because the service must be able to send
email.

Email does not create a server-readable inbox. Losing a phone can mean losing
that device's decrypted local message history.

## User Controls

The product should let users:

- Revoke a sender.
- Restrict sender capabilities.
- Change preview behavior.
- Delete or save local messages.
- Change local retention.
- Disable notifications.

Revoking a sender prevents future sends through Agent Notifier. It does not
delete local files that may still exist on the sender machine.

