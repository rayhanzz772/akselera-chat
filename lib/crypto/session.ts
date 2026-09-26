let privateKey: CryptoKey | null = null;
let publicKey: JsonWebKey | null = null;
const ENCRYPTED_KEY_PREFIX = "akselera_encrypted_key:";
const KEY_DATABASE = "akselera-crypto";
const KEY_STORE = "session";

function openKeyDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(KEY_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(KEY_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function setPrivateKey(value: CryptoKey) {
  privateKey = value;
}

export function getPrivateKey() {
  return privateKey;
}

export function setPublicKey(value: JsonWebKey) {
  publicKey = value;
}

export function getPublicKey() {
  return publicKey;
}

export function clearPrivateKey() {
  privateKey = null;
  publicKey = null;

  if (typeof indexedDB !== "undefined") {
    void openKeyDatabase().then((database) => {
      const transaction = database.transaction(KEY_STORE, "readwrite");
      transaction.objectStore(KEY_STORE).delete("current");
      transaction.oncomplete = () => database.close();
    });
  }
}

export async function persistSessionKeys(nextPrivateKey: CryptoKey, nextPublicKey: JsonWebKey) {
  privateKey = nextPrivateKey;
  publicKey = nextPublicKey;

  if (typeof indexedDB === "undefined") return;

  const database = await openKeyDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, "readwrite");
    transaction.objectStore(KEY_STORE).put({ id: "current", privateKey: nextPrivateKey, publicKey: nextPublicKey });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function restoreSessionKeys() {
  if (privateKey && publicKey) return true;
  if (typeof indexedDB === "undefined") return false;

  const database = await openKeyDatabase();
  const storedKeys = await new Promise<{ privateKey: CryptoKey; publicKey: JsonWebKey } | undefined>((resolve, reject) => {
    const request = database.transaction(KEY_STORE, "readonly").objectStore(KEY_STORE).get("current");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();

  if (!storedKeys) return false;
  privateKey = storedKeys.privateKey;
  publicKey = storedKeys.publicKey;
  return true;
}

export function saveEncryptedKeyMaterial(email: string, encryptedPrivateKey: string, keyDerivationSalt: string) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    `${ENCRYPTED_KEY_PREFIX}${email.toLowerCase()}`,
    JSON.stringify({ encryptedPrivateKey, keyDerivationSalt }),
  );
}

export function getEncryptedKeyMaterial(email: string) {
  if (typeof window === "undefined") return null;

  const value = window.localStorage.getItem(`${ENCRYPTED_KEY_PREFIX}${email.toLowerCase()}`);
  if (!value) return null;

  return JSON.parse(value) as {
    encryptedPrivateKey: string;
    keyDerivationSalt: string;
  };
}