export class ClientApiError extends Error {
  status: number;

  // The server's stable error code (e.g. "EMAIL_NOT_VERIFIED"),
  // when the response body included one — lets a caller branch
  // on a specific error case without parsing message text.
  // Optional: not every error path sets one, and older callers
  // that only read `.message` are unaffected.
  code?: string;

  constructor(
    status: number,
    message: string,
    code?: string
  ) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const isJson = res.headers
    .get("content-type")
    ?.includes("application/json");

  const body = isJson
    ? await res.json().catch(() => null)
    : null;

  if (!res.ok) {
    const message =
      body?.error?.message ||
      `Request failed (${res.status})`;

    throw new ClientApiError(
      res.status,
      message,
      body?.error?.code
    );
  }

  return body as T;
}

export const api = {
  get: <T>(url: string) =>
    request<T>(url),

  post: <T>(
    url: string,
    data?: unknown
  ) =>
    request<T>(url, {
      method: "POST",
      body: data
        ? JSON.stringify(data)
        : undefined,
    }),

  patch: <T>(
    url: string,
    data?: unknown
  ) =>
    request<T>(url, {
      method: "PATCH",
      body: data
        ? JSON.stringify(data)
        : undefined,
    }),

  del: <T>(url: string) =>
    request<T>(url, {
      method: "DELETE",
    }),
};