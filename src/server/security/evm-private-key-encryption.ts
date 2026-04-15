import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

type EncryptedPrivateKeyPayload = {
  encryptedPrivateKey: string;
  iv: string;
  salt: string;
  authTag: string;
};

function deriveEncryptionKey(password: string, salt: Buffer) {
  if (!password) {
    throw new Error('Password is required.');
  }

  return scryptSync(password, salt, KEY_LENGTH);
}

export function encryptEvmPrivateKey(
  privateKey: string,
  password: string,
): EncryptedPrivateKeyPayload {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveEncryptionKey(password, salt);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKey, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedPrivateKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptEvmPrivateKey(
  payload: EncryptedPrivateKeyPayload,
  password: string,
) {
  try {
    const salt = Buffer.from(payload.salt, 'base64');
    const iv = Buffer.from(payload.iv, 'base64');
    const encryptedPrivateKey = Buffer.from(
      payload.encryptedPrivateKey,
      'base64',
    );
    const authTag = Buffer.from(payload.authTag, 'base64');
    const key = deriveEncryptionKey(password, salt);
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encryptedPrivateKey),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('Incorrect password.');
  }
}
