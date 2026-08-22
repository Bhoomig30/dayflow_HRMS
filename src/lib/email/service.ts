import { getEmailProvider } from "./provider";

export interface SendVerificationEmailParams {
  to: string;
  fullName: string;
  verifyUrl: string;
}

export interface SendEmailResult {
  delivered: boolean;
}

/**
 * Sends the account-verification email if (and only if) a real provider is
 * configured. Never throws — a delivery failure is reported back as
 * `{ delivered: false }` so the caller can be honest with the user ("we
 * couldn't send it") rather than either crashing the signup/resend request
 * or silently claiming success. Never logs `params.verifyUrl` (or anything
 * derived from it) — only the provider's own error, which is its HTTP
 * response, not anything we sent it.
 */
export async function sendVerificationEmail(
  params: SendVerificationEmailParams
): Promise<SendEmailResult> {
  const provider = getEmailProvider();

  if (!provider) {
    return { delivered: false };
  }

  const firstName =
    params.fullName.trim().split(/\s+/)[0] ||
    "there";

  const subject =
    "Verify your Dayflow account";

  const text = [
    `Hi ${firstName},`,
    "",
    "Verify your Dayflow account by opening this link:",
    params.verifyUrl,
    "",
    "This link expires in 60 minutes and can only be used once.",
    "If you didn't create a Dayflow account, you can safely ignore this email.",
  ].join("\n");

  const html = `<p>Hi ${escapeHtml(firstName)},</p>
<p>Verify your Dayflow account by clicking the link below.</p>
<p><a href="${escapeHtml(params.verifyUrl)}">Verify email address</a></p>
<p style="color:#666;font-size:13px;">This link expires in 60 minutes and can only be used once. If you didn't create a Dayflow account, you can safely ignore this email.</p>`;

  try {
    await provider.send({
      to: params.to,
      subject,
      text,
      html,
    });

    return { delivered: true };
  } catch (err) {
    console.error(
      "[email] failed to send verification email:",
      err instanceof Error
        ? err.message
        : String(err)
    );

    return { delivered: false };
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!
  );
}