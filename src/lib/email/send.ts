import sgMail from "@sendgrid/mail";

/**
 * Transactional email via SendGrid. API key and from-address are passed in
 * per-call (sourced from the admin-editable EmailSettings row via
 * lib/email/settings.ts) rather than read from env, so changes in the admin
 * panel take effect immediately without a redeploy.
 *
 * If no API key is configured, nothing is actually sent — this reports back
 * as a failure (not a fake success) so the order timeline and any caller
 * honestly reflect that the customer never received anything, instead of
 * silently claiming "sent".
 */

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  apiKey: string | null;
  from: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!input.apiKey) {
    console.log("[email:stub] no SendGrid API key configured, not sending", {
      to: input.to,
      subject: input.subject,
    });
    return { success: false, error: "SendGrid API key is not configured — set it in Email Settings." };
  }

  try {
    sgMail.setApiKey(input.apiKey);
    await sgMail.send({
      to: input.to,
      from: input.from,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Email send failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
