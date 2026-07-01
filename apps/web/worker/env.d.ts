interface Env {
  readonly DB: D1Database;
  readonly RESEND_API_KEY?: string;
  readonly RESEND_FROM_EMAIL?: string;
  readonly VAPID_PRIVATE_KEY?: string;
  readonly VAPID_PUBLIC_KEY?: string;
  readonly VAPID_SUBJECT?: string;
}
