// services/api/utils/crypto.js
/**
 * @file crypto.js
 * @description 基于 AES-256-GCM 算法的生产级双向加密解密模块，用于高安全加密存储用户密钥和 OAuth Token。
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey() {
  const rawKey = process.env.USER_API_ENCRYPTION_SECRET || process.env.PROFILE_USER_APIS_ENCRYPTION_SECRET;
  
  if (!rawKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[CRYPTO_ERROR] USER_API_ENCRYPTION_SECRET is not configured in production environment.');
    }
    // 简体中文注释：非生产/本地开发环境下自动派生一个 32 字节的 fallback，防范本地启动及测试阻断
    return crypto.createHash('sha256').update('fallback-secret-for-dev-only-32-chars').digest();
  }

  // 简体中文注释：使用 sha256 对任意配置的 secret 进行摘要，安全派生成标准 32 字节对称密钥
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * 加密明文
 * @param {string} text - 待加密的明文字符串
 * @returns {string} iv:authTag:ciphertext 十六进制拼接的密文包
 */
function encrypt(text) {
  if (typeof text !== 'string') {
    throw new Error('Plain text must be a string.');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(text, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * 解密密文
 * @param {string} encryptedText - iv:authTag:ciphertext 格式的密文包
 * @returns {string} 解密后的明文字符串
 */
function decrypt(encryptedText) {
  if (typeof encryptedText !== 'string') {
    throw new Error('Encrypted text must be a string.');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted envelope format.');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = {
  encrypt,
  decrypt,
};
