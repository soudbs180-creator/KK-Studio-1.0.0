const crypto = require('crypto');

// Local-only helper for checking whether the configured Alipay keys match.
// Secrets must come from environment variables so no real key material lives in Git.
const appPublicKey = String(
    process.env.AP_PUB_KEY || process.env.ALIPAY_PUBLIC_KEY || ''
).trim();
const appPrivateKeyEnv = String(
    process.env.AP_APP_KEY || process.env.ALIPAY_PRIVATE_KEY || ''
).trim();

function readRequiredKey(name, value) {
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function formatPubKey(key) {
    if (key.includes('-----BEGIN')) {
        return key;
    }

    const chunks = key.match(/.{1,64}/g);
    if (!chunks) {
        throw new Error('Invalid Alipay public key format');
    }

    return `-----BEGIN PUBLIC KEY-----\n${chunks.join('\n')}\n-----END PUBLIC KEY-----`;
}

function formatPrivKey(key) {
    if (key.includes('-----BEGIN')) {
        return key;
    }

    const chunks = key.match(/.{1,64}/g);
    if (!chunks) {
        throw new Error('Invalid Alipay private key format');
    }

    return `-----BEGIN RSA PRIVATE KEY-----\n${chunks.join('\n')}\n-----END RSA PRIVATE KEY-----`;
}

try {
    const publicKey = formatPubKey(readRequiredKey('AP_PUB_KEY or ALIPAY_PUBLIC_KEY', appPublicKey));
    const privateKey = formatPrivKey(readRequiredKey('AP_APP_KEY or ALIPAY_PRIVATE_KEY', appPrivateKeyEnv));
    const pub = crypto.createPublicKey(publicKey);
    const priv = crypto.createPrivateKey(privateKey);
    const derivedPub = crypto.createPublicKey(priv);

    if (pub.export({ format: 'pem', type: 'spki' }) === derivedPub.export({ format: 'pem', type: 'spki' })) {
        console.log('MATCH: Private key matches application public key.');
    } else {
        console.log('MISMATCH: Private key does not match application public key.');
    }
} catch (error) {
    console.log('ERROR:', error.message);
    process.exitCode = 1;
}
