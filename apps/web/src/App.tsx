import { useEffect } from "react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { registerServiceWorker } from "./lib/pwa";
import { pairingLinkFromCurrentLocation } from "./lib/routes";
import { useAppState } from "./state/useAppState";
import { InboxScreen } from "./screens/InboxScreen";
import { LegalPage } from "./screens/LegalPage";
import { MessageScreen } from "./screens/MessageScreen";
import { SendersScreen } from "./screens/SendersScreen";
import { PushTroubleshootingScreen, SettingsScreen } from "./screens/SettingsScreen";
import { SetupScreen } from "./screens/SetupScreen";
import type { Route as AppRoute } from "./types";

type AppApi = ReturnType<typeof useAppState>;

export function App() {
  const app = useAppState();
  const location = useLocation();

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!app.loaded) return;
    const pairingLink = pairingLinkFromCurrentLocation();
    if (pairingLink) app.loadPairingLink(pairingLink);
  }, [app.loaded, location.pathname, location.search]);

  if (!app.loaded) {
    return <LoadingScreen />;
  }

  const ready = app.state.settings.deviceReady;

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate replace to={ready ? "/inbox" : "/setup"} />}
      />

      <Route path="/setup" element={<SetupRoute app={app} ready={ready} />} />
      <Route path="/setup/pair" element={<SetupRoute app={app} ready={ready} />} />
      <Route path="/setup/pair/:sessionId" element={<SetupRoute app={app} ready={ready} />} />

      <Route
        path="/inbox"
        element={
          <Shell route="/inbox" title="Inbox">
            <InboxScreen
              state={app.state}
              onDelete={app.deleteMessage}
              onToggleSave={app.toggleSave}
            />
          </Shell>
        }
      />
      <Route
        path="/saved"
        element={
          <Shell route="/saved" title="Saved">
            <InboxScreen
              savedOnly
              state={app.state}
              onDelete={app.deleteMessage}
              onToggleSave={app.toggleSave}
            />
          </Shell>
        }
      />
      <Route
        path="/message/:messageId"
        element={
          <Shell route="/inbox" title="Message">
            <MessageRoute app={app} />
          </Shell>
        }
      />

      <Route
        path="/senders"
        element={
          <Shell route="/senders" title="Senders">
            <SendersScreen
              senders={app.state.senders}
              onRevoke={app.revokeSender}
              onUpdate={app.updateSender}
            />
          </Shell>
        }
      />
      <Route
        path="/senders/:senderId"
        element={
          <Shell route="/senders" title="Sender">
            <SenderRoute app={app} />
          </Shell>
        }
      />

      <Route
        path="/settings"
        element={
          <Shell route="/settings" title="Settings">
            <SettingsScreen
              settings={app.state.settings}
              onPreviewPolicy={app.setGlobalPreviewPolicy}
              onPushState={app.setPushState}
              onRetention={app.setRetention}
            />
          </Shell>
        }
      />
      <Route
        path="/settings/notifications"
        element={
          <Shell route="/settings" title="Settings">
            <PushTroubleshootingScreen
              settings={app.state.settings}
              onPushState={app.setPushState}
            />
          </Shell>
        }
      />

      <Route path="/privacy" element={<LegalRoute route="/privacy" />} />
      <Route path="/security" element={<LegalRoute route="/security" />} />
      <Route path="/terms" element={<LegalRoute route="/terms" />} />

      <Route path="*" element={<Navigate replace to={ready ? "/inbox" : "/setup"} />} />
    </Routes>
  );
}

function SetupRoute({ app, ready }: { app: AppApi; ready: boolean }) {
  if (ready) return <Navigate replace to="/inbox" />;
  return (
    <main className="min-h-dvh bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <SetupScreen
        onApprovePairing={app.approvePairing}
        onPushState={app.setPushState}
        onStartPairing={app.startPairing}
        settings={app.state.settings}
      />
    </main>
  );
}

function MessageRoute({ app }: { app: AppApi }) {
  const { messageId } = useParams();
  return (
    <MessageScreen
      messageId={messageId ?? ""}
      onApproval={app.submitApproval}
      onDelete={app.deleteMessage}
      onReply={app.submitReply}
      onToggleSave={app.toggleSave}
      state={app.state}
    />
  );
}

function SenderRoute({ app }: { app: AppApi }) {
  const { senderId } = useParams();
  return (
    <SendersScreen
      senders={app.state.senders}
      onRevoke={app.revokeSender}
      onUpdate={app.updateSender}
      {...(senderId ? { selectedSenderId: senderId } : {})}
    />
  );
}

function LegalRoute({ route }: { route: AppRoute }) {
  return (
    <main className="min-h-dvh bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <LegalPage route={route} />
    </main>
  );
}

function Shell({
  children,
  route,
  title
}: {
  children: ReactNode;
  route: AppRoute;
  title: string;
}) {
  return (
    <AppShell route={route} title={title}>
      {children}
    </AppShell>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <p className="text-sm text-neutral-500">Loading local device state...</p>
    </main>
  );
}
