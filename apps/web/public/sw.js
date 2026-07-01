self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "agent-notifier:test-notification") {
    return;
  }

  event.waitUntil(
    self.registration.showNotification("Agent Notifier", {
      body: "Test notification from this device.",
      icon: "/icons/icon.svg",
      tag: "agent-notifier-test"
    })
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Agent Notifier", {
      body: "New notification",
      icon: "/icons/icon.svg",
      tag: "agent-notifier-wakeup"
    })
  );
});
