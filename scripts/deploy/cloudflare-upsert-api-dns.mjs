#!/usr/bin/env node

const token = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "";
const zoneId = process.env.CLOUDFLARE_ZONE_ID || "6e8b3a4638980f182b0c4b89bf99e6da";
const recordName = process.env.API_DNS_RECORD_NAME || "api.kkai.plus";
const recordContent = process.env.API_DNS_RECORD_IPV4 || "172.245.156.16";
const apiBaseUrl = "https://api.cloudflare.com/client/v4";

function requireConfig() {
  if (!token) {
    throw new Error(
      "Missing CF_API_TOKEN or CLOUDFLARE_API_TOKEN. Create a Cloudflare token with Zone:DNS edit permission for kkai.plus.",
    );
  }
  if (!zoneId) {
    throw new Error("Missing CLOUDFLARE_ZONE_ID.");
  }
}

async function cloudflareRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const details = Array.isArray(body.errors)
      ? body.errors.map((error) => error.message).filter(Boolean).join("; ")
      : "";
    throw new Error(`Cloudflare API request failed (${response.status})${details ? `: ${details}` : ""}`);
  }
  return body.result;
}

async function findApiRecord() {
  const params = new URLSearchParams({
    type: "A",
    name: recordName,
    per_page: "100",
  });
  const records = await cloudflareRequest(`/client/v4/zones/${zoneId}/dns_records?${params.toString()}`);
  return Array.isArray(records) ? records.find((record) => record.name === recordName) : null;
}

async function upsertApiRecord() {
  const payload = {
    type: "A",
    name: recordName,
    content: recordContent,
    ttl: 1,
    proxied: false,
    comment: "KK Studio hosted API DNS-only VPS origin for TLS issuance",
  };
  const existing = await findApiRecord();
  if (existing) {
    return cloudflareRequest(`/client/v4/zones/${zoneId}/dns_records/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }
  return cloudflareRequest(`/client/v4/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function verifyDns() {
  const lookup = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(recordName)}&type=A`, {
    headers: { accept: "application/dns-json" },
  });
  const body = await lookup.json();
  const answers = Array.isArray(body.Answer) ? body.Answer : [];
  return answers.some((answer) => answer.type === 1 && answer.data === recordContent);
}

async function main() {
  requireConfig();
  const record = await upsertApiRecord();
  console.log(
    `[cloudflare-upsert-api-dns] ${record.name} -> ${record.content} (${record.proxied ? "proxied" : "DNS-only"})`,
  );

  const verified = await verifyDns();
  if (!verified) {
    console.log("[cloudflare-upsert-api-dns] DNS update accepted; public resolver has not observed it yet.");
    return;
  }
  console.log("[cloudflare-upsert-api-dns] Public DNS resolver already observes the expected A record.");
}

main().catch((error) => {
  console.error(`[cloudflare-upsert-api-dns] ${error.message}`);
  process.exit(1);
});
