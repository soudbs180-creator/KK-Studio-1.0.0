const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "yopmail.com",
  "throwawaymail.com",
  "temp-mail.org",
  "fake-email.net",
  "sharklasers.com",
  "getairmail.com",
  "burnermail.io",
  "tempail.com",
  "gmail.cn",
  "qq.com.cn",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailValidationResult =
  | { ok: true; normalizedEmail: string }
  | { ok: false; error: string };

export function validateAuthEmail(email: string): EmailValidationResult {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return {
      ok: false,
      error: "Email format is invalid.",
    };
  }

  const domain = normalizedEmail.split("@")[1];
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      ok: false,
      error: "Disposable email domains are not allowed.",
    };
  }

  return {
    ok: true,
    normalizedEmail,
  };
}
