/**
 * E-mail service via SMTP (Nodemailer).
 * Only import in API routes (Node.js only).
 *
 * Requires env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   SMTP_FROM   (optional — defaults to SMTP_USER)
 *   SMTP_SECURE (optional — "true" forces TLS; default: auto via STARTTLS on port 587)
 */
import nodemailer from "nodemailer";

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

function getTransporter() {
  const host = process.env["SMTP_HOST"];
  const port = Number(process.env["SMTP_PORT"] ?? 587);
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  if (!host || !user || !pass) {
    throw new Error(
      "E-mail não configurado. Defina SMTP_HOST, SMTP_USER e SMTP_PASS no ambiente."
    );
  }

  const secure = process.env["SMTP_SECURE"] === "true" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendMail(options: MailOptions): Promise<void> {
  const transporter = getTransporter();
  const from = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"];

  await transporter.sendMail({
    from,
    to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

/** Returns true if all required SMTP env vars are set. */
export function isEmailConfigured(): boolean {
  return !!(
    process.env["SMTP_HOST"] &&
    process.env["SMTP_USER"] &&
    process.env["SMTP_PASS"] &&
    process.env["ALERT_EMAIL_TO"]
  );
}
