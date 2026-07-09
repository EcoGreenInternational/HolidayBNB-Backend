import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error('ENCRYPTION_KEY environment variable is required');
  return crypto.scryptSync(secret, 'hollybnb-bank-salt', 32);
}

export function encrypt(text) {
  if (!text) return text;
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  try {
    const key = getKey();
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedText;
  }
}

export function encryptBankDetails(details) {
  if (!details) return {};
  return {
    bankName: details.bankName,
    accountHolder: details.accountHolder,
    accountNumber: encrypt(details.accountNumber),
    routingNumber: encrypt(details.routingNumber),
    swiftCode: encrypt(details.swiftCode),
    currency: details.currency || 'USD',
  };
}

export function decryptBankDetails(details) {
  if (!details) return {};
  return {
    bankName: details.bankName,
    accountHolder: details.accountHolder,
    accountNumber: decrypt(details.accountNumber),
    routingNumber: decrypt(details.routingNumber),
    swiftCode: decrypt(details.swiftCode),
    currency: details.currency || 'USD',
  };
}
