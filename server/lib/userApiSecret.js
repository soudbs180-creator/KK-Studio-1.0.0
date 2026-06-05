const READONLY_SECRET_PLACEHOLDER = 'sk-readonly-0000';
const REDACTED_SECRET_PREFIX = '__kk_redacted__:';

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isEncryptedSecretEnvelope(value) {
  if (!isObjectRecord(value)) return false;
  if (value.__kkUserApiSecret === true) return true;

  const keys = Object.keys(value).map((key) => key.toLowerCase());
  const hasCipher = keys.some((key) => key === 'ciphertext' || key === 'cipher_text' || key === 'cipher');
  const hasIv = keys.includes('iv') || keys.includes('nonce');
  return hasCipher && hasIv;
}

function isEncryptedSecretJsonString(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;

  try {
    return isEncryptedSecretEnvelope(JSON.parse(trimmed));
  } catch {
    return false;
  }
}

function getBlockedUserApiSecretReason(value) {
  if (value == null) {
    return 'missing';
  }

  if (isEncryptedSecretEnvelope(value)) {
    return 'encrypted-envelope';
  }

  if (typeof value !== 'string') {
    return 'non-string-secret';
  }

  const token = value.trim();
  if (!token) {
    return 'missing';
  }

  if (token === READONLY_SECRET_PLACEHOLDER) {
    return 'readonly-placeholder';
  }

  if (token.startsWith(REDACTED_SECRET_PREFIX)) {
    return 'redacted-placeholder';
  }

  if (token === '[object Object]' || /^\[object\s+[^\]]+\]$/.test(token)) {
    return 'object-string';
  }

  if (/[\u2022\u25cf\u25e6\u2219\u2027\u2026]/.test(token) || token.includes('...')) {
    return 'masked-preview';
  }

  if (isEncryptedSecretJsonString(token)) {
    return 'encrypted-envelope';
  }

  return '';
}

function normalizeUserApiSecretForTransport(value) {
  if (getBlockedUserApiSecretReason(value)) {
    return '';
  }

  return String(value).trim();
}

function isSendableUserApiSecret(value) {
  return !getBlockedUserApiSecretReason(value);
}

module.exports = {
  READONLY_SECRET_PLACEHOLDER,
  REDACTED_SECRET_PREFIX,
  getBlockedUserApiSecretReason,
  isSendableUserApiSecret,
  normalizeUserApiSecretForTransport,
};
