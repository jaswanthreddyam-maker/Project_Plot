/**
 * ════════════════════════════════════════════════════════════════
 * AES-256-GCM Cryptographic Vault
 * ════════════════════════════════════════════════════════════════
 *
 * All API keys are encrypted at rest using AES-256-GCM, an
 * authenticated encryption (AEAD) cipher that guarantees both
 * confidentiality AND integrity.
 *
 * Key derivation strategy:
 *   finalKey = HMAC-SHA256( PBKDF2(userPassword, userSalt), masterKey )
 *
 * This two-part derivation means:
 *   • A server compromise leaking SECRET_MASTER_KEY is not enough —
 *     the attacker still needs the user's vault password.
 *   • A database dump is useless without both the master key AND
 *     the user's vault password.
 *
 * ─ CRITICAL ─
 *   The IV (Initialization Vector) MUST be unique for every
 *   encryption operation. Reusing an IV under the same key in
 *   GCM mode catastrophically breaks the cipher.
 * ════════════════════════════════════════════════════════════════
 */

import crypto from "crypto";

// ─── Constants ───────────────────────────────────────────────
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV per NIST SP 800-38D
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag
const KEY_LENGTH = 32; // 256-bit key
const PBKDF2_ITERATIONS = 100_000; // Computational cost for brute-force resistance
const PBKDF2_DIGEST = "sha512";

// ─── Types ───────────────────────────────────────────────────
export interface EncryptedPayload {
  /** Base64-encoded ciphertext */
  cipherText: string;
  /** Base64-encoded 12-byte IV */
  iv: string;
  /** Base64-encoded 16-byte authentication tag */
  authTag: string;
}

/**
 * Derives the final AES-256 decryption key by combining the
 * backend master key with the user's vault password via
 * PBKDF2 + HMAC-SHA256.
 *
 * @param masterKeyHex  - Hex-encoded 32-byte master key from process.env
 * @param userPassword  - The user's plaintext vault password
 * @param saltBase64    - User-specific base64-encoded salt (stored in User table)
 * @returns             - 32-byte Buffer suitable for AES-256-GCM
 */
export function deriveKey(
  masterKeyHex: string,
  userPassword: string,
  saltBase64: string
): Buffer {
  const salt = Buffer.from(saltBase64, "base64");

  // Step 1: Derive a 32-byte key fragment from the user's vault password
  const userDerivedKey = crypto.pbkdf2Sync(
    userPassword,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST
  );

  // Step 2: Combine with the server master key via HMAC-SHA256.
  // This ensures neither the master key alone NOR the user password
  // alone is sufficient to decrypt the vault.
  const masterKey = Buffer.from(masterKeyHex, "hex");
  const finalKey = crypto
    .createHmac("sha256", masterKey)
    .update(userDerivedKey)
    .digest();

  return finalKey; // 32 bytes (256 bits)
}

/**
 * Encrypts a plaintext string (e.g., an API key) using AES-256-GCM.
 *
 * A fresh 12-byte IV is generated for EVERY call. Reusing an IV
 * with the same key in GCM mode would be catastrophic.
 *
 * @param plaintext   - The secret to encrypt
 * @param derivedKey  - 32-byte key from deriveKey()
 * @returns           - { cipherText, iv, authTag } all base64
 */
export function encrypt(
  plaintext: string,
  derivedKey: Buffer
): EncryptedPayload {
  // Generate a cryptographically random 12-byte IV
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    cipherText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload.
 *
 * If the ciphertext or auth tag has been tampered with (even a
 * single bit), the auth tag validation will fail and a crypto
 * exception is thrown — preventing the use of corrupted data.
 *
 * @param payload    - { cipherText, iv, authTag } from the database
 * @param derivedKey - 32-byte key reconstructed via deriveKey()
 * @returns          - The original plaintext secret
 * @throws           - If auth tag validation fails (tampering detected)
 */
export function decrypt(
  payload: EncryptedPayload,
  derivedKey: Buffer
): string {
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  const cipherText = Buffer.from(payload.cipherText, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Apply the authentication tag BEFORE decrypting
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(cipherText),
    decipher.final(), // Throws if auth tag fails
  ]);

  return decrypted.toString("utf8");
}

/**
 * Generates a cryptographically random salt for PBKDF2 derivation.
 * Called once during user registration and stored in the User table.
 *
 * @returns Base64-encoded 32-byte random salt
 */
export function generateSalt(): string {
  return crypto.randomBytes(32).toString("base64");
}

/**
 * Masks a secret for frontend display. The full secret is NEVER
 * sent to the client after initial save.
 *
 * "sk-abc123XYZ789" → "sk-••••••••Z789"
 *
 * @param secret - The plaintext secret (only used server-side)
 * @returns      - Masked string safe for UI display
 */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return "••••••••";
  }
  const prefix = secret.slice(0, 3);
  const suffix = secret.slice(-4);
  return `${prefix}-${"••••••••"}${suffix}`;
}

/**
 * Encrypts the unlock fragment for storage in the NextAuth JWT.
 * Uses the NEXTAUTH_SECRET as the encryption key for the fragment.
 *
 * @param derivedKeyHex - Hex representation of the derived vault key
 * @param jwtSecret     - The NEXTAUTH_SECRET / AUTH_SECRET
 * @returns             - Base64-encoded encrypted fragment
 */
export function encryptFragment(
  derivedKeyHex: string,
  jwtSecret: string
): string {
  // Use SHA-256 of the JWT secret as the fragment encryption key
  const fragmentKey = crypto
    .createHash("sha256")
    .update(jwtSecret)
    .digest();

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, fragmentKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(derivedKeyHex, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Pack IV + authTag + ciphertext into a single base64 string
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString("base64");
}

/**
 * Decrypts the unlock fragment from the NextAuth JWT.
 *
 * @param packedBase64 - The packed encrypted fragment from the JWT
 * @param jwtSecret    - The NEXTAUTH_SECRET / AUTH_SECRET
 * @returns            - Hex string of the derived vault key
 */
export function decryptFragment(
  packedBase64: string,
  jwtSecret: string
): string {
  const fragmentKey = crypto
    .createHash("sha256")
    .update(jwtSecret)
    .digest();

  const packed = Buffer.from(packedBase64, "base64");

  // Unpack: first 12 bytes = IV, next 16 = authTag, rest = ciphertext
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const cipherText = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, fragmentKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(cipherText),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
