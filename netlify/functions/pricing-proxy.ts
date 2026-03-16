import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Pricing proxy endpoint
 * Only proxies external supplier pricing catalogs and rejects localhost/private-network targets.
 */

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

const PRIVATE_IPV4_PATTERNS = [
    /^0\./,
    /^10\./,
    /^127\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^192\.168\./,
];

const FORBIDDEN_HOSTNAME_SUFFIXES = [
    ".internal",
    ".local",
    ".localdomain",
    ".localhost",
    ".home",
    ".lan",
];

function normalizeHostForChecks(hostname: string): string {
    return String(hostname || "")
        .trim()
        .toLowerCase()
        .replace(/^\[|\]$/g, "")
        .split("%")[0];
}

function isPrivateIpAddress(hostname: string): boolean {
    const normalized = normalizeHostForChecks(hostname);
    const ipVersion = isIP(normalized);

    if (ipVersion === 4) {
        return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(normalized));
    }

    if (ipVersion === 6) {
        return normalized === "::"
            || normalized === "::1"
            || /^f[cd][0-9a-f]{0,2}:/i.test(normalized)
            || /^fe[89ab][0-9a-f]?:/i.test(normalized)
            || /^::ffff:(?:0:)?(?:10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(normalized);
    }

    return false;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...corsHeaders,
        },
    });

function isForbiddenHostname(hostname: string): boolean {
    const lower = normalizeHostForChecks(hostname);
    if (!lower) return true;
    if (lower === "localhost") return true;
    if (lower.includes("localhost")) return true;
    if (FORBIDDEN_HOSTNAME_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true;
    if (lower.endsWith(".nip.io") || lower.endsWith(".sslip.io")) return true;
    if (isPrivateIpAddress(lower)) return true;
    return false;
}

async function assertResolvedHostIsPublic(hostname: string): Promise<void> {
    const normalized = normalizeHostForChecks(hostname);
    if (!normalized || isIP(normalized)) {
        return;
    }

    const records = await lookup(normalized, { all: true, verbatim: true });
    if (!records.length) {
        throw new Error("Supplier hostname did not resolve");
    }

    // Block hostnames that resolve into loopback or private network ranges.
    if (records.some((record) => isPrivateIpAddress(record.address))) {
        throw new Error("Supplier hostname resolved to a private or loopback address");
    }
}

async function buildPricingUrl(rawBaseUrl: string): Promise<string> {
    const parsed = new URL(String(rawBaseUrl || "").trim());

    if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Only http/https supplier URLs are allowed");
    }

    if (parsed.username || parsed.password) {
        throw new Error("Supplier URL must not contain embedded credentials");
    }

    if (isForbiddenHostname(parsed.hostname)) {
        throw new Error("Private, local, or loopback supplier URLs are not allowed");
    }

    await assertResolvedHostIsPublic(parsed.hostname);

    parsed.hash = "";
    parsed.search = "";

    const normalizedPath = parsed.pathname
        .replace(/\/v1\/?$/i, "")
        .replace(/\/+$/, "");

    parsed.pathname = `${normalizedPath}/api/pricing`.replace(/\/{2,}/g, "/");
    return parsed.toString();
}

export default async (request: Request) => {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Only POST is allowed" }, 405);
    }

    try {
        const body = await request.json() as { baseUrl?: string };
        if (!body.baseUrl) {
            return jsonResponse({ error: "Missing baseUrl" }, 400);
        }

        const pricingUrl = await buildPricingUrl(body.baseUrl);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let response: Response;
        try {
            response = await fetch(pricingUrl, {
                method: "GET",
                headers: { Accept: "application/json" },
                redirect: "error",
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            return jsonResponse({
                error: `Supplier returned ${response.status}`,
                status: response.status,
            });
        }

        const text = await response.text();
        if (text.trimStart().startsWith("<!")) {
            return jsonResponse({ error: "Supplier returned HTML instead of JSON" });
        }

        let data: any;
        try {
            data = JSON.parse(text);
        } catch {
            return jsonResponse({ error: "Supplier response is not valid JSON" });
        }

        return jsonResponse({
            success: true,
            data: Array.isArray(data.data) ? data.data : [],
            group_ratio: data.group_ratio || {},
        });
    } catch (error: any) {
        console.error("[pricing-proxy] error:", error);
        return jsonResponse({ error: error.message || "Pricing proxy request failed" }, 400);
    }
};

export const config = {
    path: "/api/pricing-proxy",
};
