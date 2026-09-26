type EncryptedMessagePayload = {
	ciphertext: string;
	iv: string;
	auth_tag: string;
};

function toBase64(value: ArrayBuffer | Uint8Array) {
	const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
	let binary = "";

	for (const byte of bytes) binary += String.fromCharCode(byte);

	return btoa(binary);
}

function fromBase64(value: string) {
	const binary = atob(value);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parsePublicKey(publicKey: JsonWebKey | string) {
	return typeof publicKey === "string" ? JSON.parse(publicKey) as JsonWebKey : publicKey;
}

export async function encryptMessage(
	plaintext: string,
	recipientPublicKey: JsonWebKey | string,
	senderPublicKey: JsonWebKey | string,
): Promise<EncryptedMessagePayload> {
	const recipientKey = await crypto.subtle.importKey(
		"jwk",
		parsePublicKey(recipientPublicKey),
		{ name: "RSA-OAEP", hash: "SHA-256" },
		false,
		["encrypt"],
	);
	const senderKey = await crypto.subtle.importKey(
		"jwk",
		parsePublicKey(senderPublicKey),
		{ name: "RSA-OAEP", hash: "SHA-256" },
		false,
		["encrypt"],
	);
	const messageKey = await crypto.subtle.generateKey(
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt", "decrypt"],
	);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = new Uint8Array(await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		messageKey,
		new TextEncoder().encode(plaintext),
	));
	const authTag = encrypted.slice(-16);
	const ciphertext = encrypted.slice(0, -16);
	const rawMessageKey = await crypto.subtle.exportKey("raw", messageKey);
	const [wrappedRecipientKey, wrappedSenderKey] = await Promise.all([
		crypto.subtle.encrypt("RSA-OAEP", recipientKey, rawMessageKey),
		crypto.subtle.encrypt("RSA-OAEP", senderKey, rawMessageKey),
	]);

	return {
		ciphertext: JSON.stringify({
			algorithm: "AES-GCM",
			wrapped_keys: {
				recipient: toBase64(wrappedRecipientKey),
				sender: toBase64(wrappedSenderKey),
			},
			ciphertext: toBase64(ciphertext),
		}),
		iv: toBase64(iv),
		auth_tag: toBase64(authTag),
	};
}

export async function decryptMessage(
	payload: EncryptedMessagePayload,
	privateKey: CryptoKey,
) {
	const envelope = JSON.parse(payload.ciphertext) as {
		wrapped_key?: string;
		wrapped_keys?: { recipient?: string; sender?: string };
		ciphertext: string;
	};
	const wrappedKeys = envelope.wrapped_keys
		? Object.values(envelope.wrapped_keys).filter((value): value is string => Boolean(value))
		: envelope.wrapped_key ? [envelope.wrapped_key] : [];
	let rawMessageKey: ArrayBuffer | null = null;

	for (const wrappedKey of wrappedKeys) {
		try {
			rawMessageKey = await crypto.subtle.decrypt("RSA-OAEP", privateKey, fromBase64(wrappedKey));
			break;
		} catch {
			// Try the other wrapped key or the legacy key.
		}
	}

	if (!rawMessageKey) throw new Error("Message key could not be decrypted.");
	const messageKey = await crypto.subtle.importKey(
		"raw",
		rawMessageKey,
		{ name: "AES-GCM" },
		false,
		["decrypt"],
	);
	const encrypted = new Uint8Array([
		...fromBase64(envelope.ciphertext),
		...fromBase64(payload.auth_tag),
	]);
	const plaintext = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: fromBase64(payload.iv) },
		messageKey,
		encrypted,
	);

	return new TextDecoder().decode(plaintext);
}