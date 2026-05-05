import { normalizeRouteString } from "./local-user-route-auth.ts";

export function normalizeDirectOpenAIBaseUrl(url: string | undefined): string {
  let clean = normalizeRouteString(url) || "https://api.openai.com";
  clean = clean.replace(/\/+$/, "");
  clean = clean.replace(/\/(?:chat\/completions|images\/generations|images\/edits|responses|models)$/i, "");
  if (!/\/v\d[\w.-]*$/i.test(clean)) {
    clean = `${clean}/v1`;
  }
  return clean.replace(/\/+$/, "");
}

export function buildDirectOpenAIEndpoint(baseUrl: string | undefined, endpoint: string): string {
  return `${normalizeDirectOpenAIBaseUrl(baseUrl)}/${endpoint.replace(/^\/+/, "")}`;
}

export function normalizeDirectClaudeBaseUrl(url: string | undefined): string {
  let clean = normalizeRouteString(url) || "https://api.anthropic.com";
  clean = clean.replace(/\/+$/, "");
  clean = clean.replace(/\/(?:messages|models)$/i, "");
  if (!/\/v\d[\w.-]*$/i.test(clean)) {
    clean = `${clean}/v1`;
  }
  return clean.replace(/\/+$/, "");
}

export function buildDirectClaudeEndpoint(baseUrl: string | undefined, endpoint: string): string {
  return `${normalizeDirectClaudeBaseUrl(baseUrl)}/${endpoint.replace(/^\/+/, "")}`;
}

export function normalizeDirectGeminiBaseUrl(url: string | undefined): string {
  let clean = normalizeRouteString(url) || "https://generativelanguage.googleapis.com";
  clean = clean
    .replace(/\/v1beta\/models\/[^/?]+:(?:generateContent|streamGenerateContent)$/i, "")
    .replace(/\/v1\/models\/[^/?]+:(?:generateContent|streamGenerateContent)$/i, "")
    .replace(/\/+$/, "");

  const suffixes = ["/v1beta/models", "/v1/models", "/models", "/v1beta", "/v1"];
  let stripped = true;
  while (stripped) {
    stripped = false;
    const lower = clean.toLowerCase();
    for (const suffix of suffixes) {
      if (lower.endsWith(suffix)) {
        clean = clean.slice(0, -suffix.length).replace(/\/+$/, "");
        stripped = true;
        break;
      }
    }
  }

  return clean || "https://generativelanguage.googleapis.com";
}
