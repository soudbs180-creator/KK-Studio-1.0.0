import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.KK_LOG_LEVEL ??= "WARN";
process.env.KK_API_SESSION_SIGNING_SECRET ??= "unit-test-kk-session-signing-secret";

const originalConsoleWarn = console.warn.bind(console);
const originalConsoleError = console.error.bind(console);

const suppressedTextFragments = [];

const suppressedStructuredWarningMessages = new Set([
  "Falling back to file-backed local auth data repository",
  "Falling back to in-memory admin console repository",
  "Falling back to in-memory credit account repository",
  "Falling back to in-memory credit exchange-rate repository",
  "Falling back to in-memory credit provider repository",
  "Falling back to in-memory workspace layout repository",
  "Using in-memory admin console repository for KKAI local-only runtime",
  "Using file-backed credit account repository for KKAI local-only runtime",
  "Using file-backed credit exchange-rate repository for KKAI local-only runtime",
  "Using in-memory credit provider repository for KKAI local-only runtime",
  "WeChat auth service is disabled because the PostgreSQL WeChat repository is unavailable.",
  "WeChat auth service is disabled because WeChat env vars are incomplete.",
  "Failed to persist user API entries to the cloud mirror.",
  "Rejected WeChat callback before code exchange",
  "Ignoring mismatched client-supplied credit amount",
  "Falling back to in-memory payment order repository",
]);

const suppressedStructuredErrorMessages = new Set([
  "WeChat callback failed",
]);

function readStructuredMessage(args) {
  const [firstArg] = args;
  if (typeof firstArg !== "string" || !firstArg.trim().startsWith("{")) {
    return null;
  }

  try {
    const payload = JSON.parse(firstArg);
    return typeof payload?.message === "string" ? payload.message : null;
  } catch {
    return null;
  }
}

function shouldSuppressConsoleText(args) {
  const joined = args.map((value) => String(value)).join(" ");
  return suppressedTextFragments.some((fragment) => joined.includes(fragment));
}

function shouldSuppressStructuredLog(args, allowedMessages) {
  const message = readStructuredMessage(args);
  return message ? allowedMessages.has(message) : false;
}

console.warn = (...args) => {
  if (shouldSuppressConsoleText(args) || shouldSuppressStructuredLog(args, suppressedStructuredWarningMessages)) {
    return;
  }

  originalConsoleWarn(...args);
};

console.error = (...args) => {
  if (shouldSuppressConsoleText(args) || shouldSuppressStructuredLog(args, suppressedStructuredErrorMessages)) {
    return;
  }

  originalConsoleError(...args);
};
