/**
 * Email provider abstraction — deliberately mirrors lib/ai/provider.ts:
 * the active provider is selected entirely by environment variables, and
 * if none are configured, getEmailProvider() returns null so callers can
 * degrade honestly (see lib/email/service.ts) instead of pretending an
 * email was sent.
 *
 *   EMAIL_PROVIDER  "resend" | "sendgrid"   (which HTTP API to call)
 *   EMAIL_API_KEY   secret key for that provider
 *   EMAIL_FROM      the "from" address to send as, e.g. "noreply@yourdomain.com"
 *                    (must be a sender/domain verified with that provider)
 *
 * Both providers here are called over plain HTTP (fetch), the same way the
 * AI providers are — no additional SDK dependency to install.
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  readonly name: string;
  send(params: SendEmailParams): Promise<void>;
}

const FROM_NAME = "Dayflow";

class ResendProvider implements EmailProvider {
  readonly name = "resend";

  constructor(
    private apiKey: string,
    private from: string
  ) {}

  async send(
    params: SendEmailParams
  ): Promise<void> {
    const res = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: `${FROM_NAME} <${this.from}>`,
          to: [params.to],
          subject: params.subject,
          text: params.text,
          html: params.html,
        }),
      }
    );

    if (!res.ok) {
      // Safe to log: this is the PROVIDER's response body, never anything
      // we sent (so never the verification link/token) — see
      // lib/email/service.ts for the "never log the token" guarantee.
      const text = await res
        .text()
        .catch(() => "");

      throw new Error(
        `Resend API error ${res.status}: ${text.slice(
          0,
          300
        )}`
      );
    }
  }
}

class SendGridProvider
  implements EmailProvider
{
  readonly name = "sendgrid";

  constructor(
    private apiKey: string,
    private from: string
  ) {}

  async send(
    params: SendEmailParams
  ): Promise<void> {
    const res = await fetch(
      "https://api.sendgrid.com/v3/mail/send",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [
                {
                  email: params.to,
                },
              ],
            },
          ],
          from: {
            email: this.from,
            name: FROM_NAME,
          },
          subject: params.subject,
          content: [
            {
              type: "text/plain",
              value: params.text,
            },
            {
              type: "text/html",
              value: params.html,
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      const text = await res
        .text()
        .catch(() => "");

      throw new Error(
        `SendGrid API error ${res.status}: ${text.slice(
          0,
          300
        )}`
      );
    }
  }
}

export function getEmailProvider():
  | EmailProvider
  | null {
  const providerName = (
    process.env.EMAIL_PROVIDER || ""
  ).toLowerCase();

  const apiKey =
    process.env.EMAIL_API_KEY;

  const from =
    process.env.EMAIL_FROM;

  if (
    !providerName ||
    !apiKey ||
    !from
  ) {
    return null;
  }

  if (
    providerName === "resend"
  ) {
    return new ResendProvider(
      apiKey,
      from
    );
  }

  if (
    providerName === "sendgrid"
  ) {
    return new SendGridProvider(
      apiKey,
      from
    );
  }

  return null;
}

export function isEmailConfigured(): boolean {
  return getEmailProvider() !== null;
}