import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface PasswordChangeCodeEmailPayload {
  userId: string;
  email: string;
  code: string;
  expiresAt: string;
}

export interface PasswordChangeCodeEmailSender {
  sendPasswordChangeCode(payload: PasswordChangeCodeEmailPayload): Promise<void>;
}

interface ResendEmailBody {
  from: string;
  to: string[];
  subject: string;
  text: string;
}

class LocalFilePasswordChangeCodeEmailSender implements PasswordChangeCodeEmailSender {
  private readonly outboxDirectory: string;

  constructor(outboxDirectory?: string) {
    this.outboxDirectory = outboxDirectory?.trim()
      ? path.resolve(outboxDirectory.trim())
      : path.resolve(process.cwd(), ".kk-local", "email-outbox");
  }

  async sendPasswordChangeCode(payload: PasswordChangeCodeEmailPayload): Promise<void> {
    mkdirSync(this.outboxDirectory, { recursive: true });
    const filePath = path.join(
      this.outboxDirectory,
      `password-change-${Date.now()}-${payload.userId}.json`,
    );
    writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  }
}

class ResendPasswordChangeCodeEmailSender implements PasswordChangeCodeEmailSender {
  private readonly apiKey: string;
  private readonly from: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { apiKey: string; from: string; fetchImpl?: typeof fetch }) {
    this.apiKey = options.apiKey;
    this.from = options.from;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async sendPasswordChangeCode(payload: PasswordChangeCodeEmailPayload): Promise<void> {
    const body: ResendEmailBody = {
      from: this.from,
      to: [payload.email],
      subject: "KK Studio password change verification code",
      text: [
        "Your KK Studio password change verification code is:",
        payload.code,
        "",
        `This code expires at ${payload.expiresAt}.`,
      ].join("\n"),
    };

    const response = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Password change email delivery failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`,
      );
    }
  }
}

export function createPasswordChangeCodeEmailSenderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): PasswordChangeCodeEmailSender {
  const resendApiKey = String(env.RESEND_API_KEY || "").trim();
  const resendFrom = String(env.AUTH_EMAIL_FROM || "").trim();
  if (resendApiKey && resendFrom) {
    return new ResendPasswordChangeCodeEmailSender({
      apiKey: resendApiKey,
      from: resendFrom,
    });
  }

  const configuredOutbox = String(env.KK_LOCAL_EMAIL_OUTBOX_DIR || "").trim();
  return new LocalFilePasswordChangeCodeEmailSender(configuredOutbox || undefined);
}
