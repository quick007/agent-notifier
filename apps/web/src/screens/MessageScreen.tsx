import { navigate } from "../lib/routes";
import type { AppState } from "../types";
import { MessageDetail } from "../components/MessageDetail";
import { Button } from "../components/ui";

export function MessageScreen({
  messageId,
  state,
  onApproval,
  onDelete,
  onReply,
  onToggleSave
}: {
  messageId: string;
  state: AppState;
  onApproval: (
    messageId: string,
    decision: "approved" | "rejected",
    text?: string
  ) => void;
  onDelete: (messageId: string) => void;
  onReply: (messageId: string, text: string) => void;
  onToggleSave: (messageId: string) => void;
}) {
  const message = state.messages.find((item) => item.id === messageId);

  if (!message || message.deleted) {
    return (
      <section className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-12 text-center">
        <h1 className="text-xl font-semibold">Message unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          This message may have expired or been deleted from local history.
        </p>
        <Button className="mt-5" onClick={() => navigate("/inbox")}>
          Back to inbox
        </Button>
      </section>
    );
  }

  const sender = state.senders.find((item) => item.id === message.senderId);

  return (
    <MessageDetail
      message={message}
      onApproval={(decision, text) => onApproval(message.id, decision, text)}
      onDelete={() => {
        onDelete(message.id);
        navigate("/inbox");
      }}
      onReply={(text) => onReply(message.id, text)}
      onToggleSave={() => onToggleSave(message.id)}
      sender={sender}
    />
  );
}
