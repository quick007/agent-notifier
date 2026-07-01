export const MCP_INSTRUCTIONS = [
  "Use Agent Notifier only for meaningful notifications, user-requested alerts, blocked work, or approvals already required by the task.",
  "Do not use this for routine progress updates unless the user asked for them.",
  "Do not invent new approval gates just because this tool exists.",
  "Ask before sending a setup email unless the user clearly delegated setup.",
  "Mark messages sensitive when they include secrets, tokens, credentials, private personal data, unreleased details, or logs likely to contain credentials.",
  "Prefer email setup; mention pairing code as the fallback.",
].join("\n");

export function usagePolicyPayload(): Record<string, unknown> {
  return {
    ok: true,
    policy: {
      meaningfulOnly: true,
      routineProgressSpam: false,
      inventedApprovalGates: false,
      askBeforeSetupEmailUnlessDelegated: true,
      sensitiveWhen: [
        "secrets",
        "tokens",
        "credentials",
        "private personal data",
        "unreleased details",
        "logs likely to contain credentials",
      ],
      preferredSetup: "email",
      fallbackSetup: "pairing_code",
    },
  };
}
