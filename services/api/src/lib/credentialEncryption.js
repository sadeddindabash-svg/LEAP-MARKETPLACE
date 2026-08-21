const crypto = require('crypto');
const { env } = require('../config/env');

/**
 * Real, encrypted-at-rest storage for payment provider credentials
 * (migration 065) -- AES-256-GCM, a real authenticated encryption
 * mode (detects tampering, not just confidentiality).
 *
 * The real master key (CREDENTIALS_ENCRYPTION_KEY) is always run
 * through a real SHA-256 hash first to derive the actual 32-byte AES
 * key, regardless of the raw env var's own length or format -- this
 * means it works correctly whether someone pastes in a real 64-char
 * hex string (from `openssl rand -hex 32`), a real plain passphrase,
 * or anything else, without a real crash from Node's own AES-256
 * implementation demanding an exact 32-byte key.
 */
function deriveKey() {
  return crypto.createHash('sha256').update(env.credentialsEncryptionKey).digest();
}

/**
 * Encrypts a real plain JavaScript object (e.g. { secretKey: '...' })
 * into the real "iv:authTag:ciphertext" hex-encoded string stored in
 * payment_provider_credentials.encrypted_credentials.
 */
function encryptCredentials(credentialsObject) {
  const key = deriveKey();
  const iv = crypto.randomBytes(12); // real, standard IV length for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(credentialsObject);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts a real stored string back into the real plain
 * JavaScript object. Throws if the real stored value has been
 * tampered with (GCM's own real auth tag check) or the real master
 * key has changed since it was encrypted.
 */
function decryptCredentials(storedValue) {
  const [ivHex, authTagHex, ciphertextHex] = storedValue.split(':');
  const key = deriveKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

module.exports = { encryptCredentials, decryptCredentials };
