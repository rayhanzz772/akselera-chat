const RSA_ALGORITHM: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 4096,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

const PBKDF2_ITERATIONS = 600_000;

function toBase64(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function unlockPrivateKey(
  password: string,
  encryptedPrivateKey: string,
  keyDerivationSalt: string,
) {
  const envelope = JSON.parse(encryptedPrivateKey) as {
    iv: string;
    ciphertext: string;
    key_derivation: { iterations: number; hash: string };
  };
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const decryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromBase64(keyDerivationSalt),
      iterations: envelope.key_derivation.iterations,
      hash: envelope.key_derivation.hash,
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const privateKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(envelope.iv) },
    decryptionKey,
    fromBase64(envelope.ciphertext),
  );

  return crypto.subtle.importKey(
    "pkcs8",
    privateKey,
    RSA_ALGORITHM,
    true,
    ["decrypt"],
  );
}

export async function getPublicKeyFromPrivateKey(privateKey: CryptoKey) {
  const privateJwk = await crypto.subtle.exportKey("jwk", privateKey);

  return {
    kty: privateJwk.kty,
    n: privateJwk.n,
    e: privateJwk.e,
    alg: privateJwk.alg,
    ext: true,
    key_ops: ["encrypt"],
  } satisfies JsonWebKey;
}

export async function createUserKeyMaterial(password: string) {
  const keyPair = await crypto.subtle.generateKey(RSA_ALGORITHM, true, [
    "encrypt",
    "decrypt",
  ]);
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const encryptedPrivateKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    privateKey,
  );

  return {
    public_key: JSON.stringify(publicKey),
    encrypted_private_key: JSON.stringify({
      algorithm: "AES-GCM",
      iv: toBase64(iv),
      ciphertext: toBase64(encryptedPrivateKey),
      key_derivation: {
        algorithm: "PBKDF2",
        hash: "SHA-256",
        iterations: PBKDF2_ITERATIONS,
      },
    }),
    key_derivation_salt: toBase64(salt),
  };
}
