import { ENV } from "./_core/env";

export type AccountEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function isEmailDeliveryConfigured() {
  return Boolean(ENV.emailProviderUrl && ENV.emailApiKey && ENV.emailFrom);
}

export function getEmailServiceStatus() {
  return {
    configured: isEmailDeliveryConfigured(),
    provider: ENV.emailProviderUrl
      ? new URL(ENV.emailProviderUrl).hostname
      : null,
  };
}

export async function sendAccountEmail(email: AccountEmail) {
  if (!isEmailDeliveryConfigured()) {
    throw new Error(
      "Email delivery is not configured. Set EMAIL_PROVIDER_URL, EMAIL_API_KEY, and EMAIL_FROM on the server."
    );
  }

  const response = await fetch(`${ENV.emailProviderUrl}/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.emailApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.emailFrom,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Email provider request failed (${response.status}).`);
  }
}
