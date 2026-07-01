self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "agent-notifier:test-notification") {
    event.waitUntil(
      self.registration.showNotification("Agent Notifier", {
        body: "Test notification from this device.",
        icon: "/icons/icon.svg",
        tag: "agent-notifier-test"
      })
    );
  }
});

self.addEventListener("push", (event) => {
  event.waitUntil(handlePushWakeup(readPushPayload(event)));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/inbox";
  event.waitUntil(openOrFocus(url));
});

async function handlePushWakeup(push) {
  const windows = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window"
  });

  const messageId = typeof push.messageId === "string" ? push.messageId : undefined;
  const syncMessage = {
    type: "agent-notifier:sync-pending",
    deliveryPath: "client_decrypt_required",
    ...(messageId ? { messageId } : {})
  };

  for (const client of windows) {
    client.postMessage(syncMessage);
  }

  if (windows.length === 0) {
    // Closed-app push is wake-only until protocol crypto is bundled into the worker.
    // The app must fetch, decrypt, store, and report delivery before previews appear.
    await self.registration.showNotification("Agent Notifier", {
      body: "Open to fetch and decrypt new encrypted messages.",
      icon: "/icons/icon.svg",
      tag: "agent-notifier-wakeup",
      data: {
        url: "/inbox",
        deliveryPath: "wake_only",
        ...(messageId ? { messageId } : {})
      }
    });
  }
}

async function openOrFocus(url) {
  const windows = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window"
  });
  for (const client of windows) {
    if ("focus" in client) {
      client.postMessage({
        type: "agent-notifier:sync-pending",
        deliveryPath: "client_decrypt_required"
      });
      return client.focus();
    }
  }
  return self.clients.openWindow(url);
}

function readPushPayload(event) {
  if (!event.data) return {};
  try {
    const json = event.data.json();
    return json && typeof json === "object" ? json : {};
  } catch {
    return {};
  }
}
