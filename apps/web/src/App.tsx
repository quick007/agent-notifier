import { useEffect } from "react";

import { AppShell } from "./components/AppShell";
import { registerServiceWorker } from "./lib/pwa";
import {
  messageIdFromRoute,
  pairingLinkFromCurrentLocation,
  senderIdFromRoute,
  useRoute
} from "./lib/routes";
import { useAppState } from "./state/useAppState";
import { InboxScreen } from "./screens/InboxScreen";
import { LegalPage } from "./screens/LegalPage";
import { MessageScreen } from "./screens/MessageScreen";
import { SendersScreen } from "./screens/SendersScreen";
import { PushTroubleshootingScreen, SettingsScreen } from "./screens/SettingsScreen";
import { SetupScreen } from "./screens/SetupScreen";
import type { Route } from "./types";

const legalRoutes = new Set<Route>(["/privacy", "/security", "/terms"]);

export function App() {
  const route = useRoute();
  const app = useAppState();

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!app.loaded) return;
    const pairingLink = pairingLinkFromCurrentLocation();
    if (pairingLink) app.loadPairingLink(pairingLink);
  }, [app.loaded, route]);

  if (!app.loaded) {
    return <LoadingScreen />;
  }

  const effectiveRoute = resolveRoute(route, app.state.settings.deviceReady);
  const content = renderRoute(effectiveRoute, app);

  if (!app.state.settings.deviceReady && !legalRoutes.has(effectiveRoute)) {
    return (
      <main className="min-h-dvh bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
        {content}
      </main>
    );
  }

  return (
    <AppShell route={effectiveRoute} title={titleForRoute(effectiveRoute)}>
      {content}
    </AppShell>
  );
}

function renderRoute(route: Route, app: ReturnType<typeof useAppState>) {
  const messageId = messageIdFromRoute(route);
  const senderId = senderIdFromRoute(route);

  if (messageId) {
    return (
      <MessageScreen
        messageId={messageId}
        onApproval={app.submitApproval}
        onDelete={app.deleteMessage}
        onReply={app.submitReply}
        onToggleSave={app.toggleSave}
        state={app.state}
      />
    );
  }

  if (legalRoutes.has(route)) return <LegalPage route={route} />;
  if (route === "/saved") return <InboxScreen savedOnly state={app.state} onDelete={app.deleteMessage} onToggleSave={app.toggleSave} />;
  if (route === "/senders" || senderId) {
    return (
      <SendersScreen
        senders={app.state.senders}
        onRevoke={app.revokeSender}
        onUpdate={app.updateSender}
        {...(senderId ? { selectedSenderId: senderId } : {})}
      />
    );
  }
  if (route === "/settings") return <SettingsScreen settings={app.state.settings} onPreviewPolicy={app.setGlobalPreviewPolicy} onPushState={app.setPushState} onRetention={app.setRetention} />;
  if (route === "/settings/notifications") return <PushTroubleshootingScreen settings={app.state.settings} onPushState={app.setPushState} />;
  if (route === "/inbox") return <InboxScreen state={app.state} onDelete={app.deleteMessage} onToggleSave={app.toggleSave} />;

  return (
    <SetupScreen
      onApprovePairing={app.approvePairing}
      onPushState={app.setPushState}
      onStartPairing={app.startPairing}
      settings={app.state.settings}
    />
  );
}

function homeRoute(deviceReady: boolean): Route {
  return deviceReady ? "/inbox" : "/setup";
}

function resolveRoute(route: Route, deviceReady: boolean): Route {
  if (route === "/") return homeRoute(deviceReady);
  if (deviceReady && route === "/setup") return "/inbox";
  return route;
}

function titleForRoute(route: Route) {
  if (route.startsWith("/message/")) return "Message";
  if (route.startsWith("/senders/")) return "Sender";
  if (route === "/saved") return "Saved";
  if (route === "/senders") return "Senders";
  if (route === "/settings" || route === "/settings/notifications") return "Settings";
  if (route === "/privacy") return "Privacy";
  if (route === "/security") return "Security";
  if (route === "/terms") return "Terms";
  return "Inbox";
}

function LoadingScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <p className="text-sm text-neutral-500">Loading local device state...</p>
    </main>
  );
}
