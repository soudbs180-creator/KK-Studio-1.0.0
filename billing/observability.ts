const REDACTED_VALUE = '[REDACTED]'

function sanitizeBillingPayload(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/\b(Authorization\s*:\s*Bearer)\s+[^\s,;]+/gi, `$1 ${REDACTED_VALUE}`)
    .replace(/\b(Bearer)\s+[^\s,;]+/gi, `$1 ${REDACTED_VALUE}`)
    .replace(
      /("(?:api[_-]?key|access[_-]?token|refresh[_-]?token|system[_-]?token|service[_-]?role[_-]?key|authorization|secret|password)"\s*:\s*)"[^"]*"/gi,
      `$1"${REDACTED_VALUE}"`,
    )
}

export function logBillingEvent(eventType: string, payload: any) {
  const ts = new Date().toISOString()
  console.log(`[Billing][${ts}][${eventType}] ${sanitizeBillingPayload(payload)}`)
}
