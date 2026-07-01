export const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
} as const;

export const securityHeaders = {
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "manifest-src 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
  ].join("; "),
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-permitted-cross-domain-policies": "none",
} as const;

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return withSecurityHeaders(
    new Response(JSON.stringify(body), {
      ...init,
      headers: { ...jsonHeaders, ...init.headers },
    }),
  );
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return jsonResponse(
      {
        error: error.code,
        message: error.message,
        ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
      },
      { status: error.status },
    );
  }

  console.error("Unhandled API error", error);
  return jsonResponse(
    { error: "internal_error", message: "Something went wrong." },
    { status: 500 },
  );
}

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(securityHeaders)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
