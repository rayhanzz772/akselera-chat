import { apiRequest } from "./client";
import type { EncryptedMessage } from "@/types/chat";
import type { DecryptedMessage } from "@/types/chat";

export type CreateMessagePayload = {
	ciphertext: string;
	iv: string;
	auth_tag: string;
};

export async function createMessage(conversationId: string, payload: CreateMessagePayload) {
	const response = await apiRequest<EncryptedMessage | { data: EncryptedMessage }>(`/conversations/${conversationId}/messages`, {
		method: "POST",
		body: JSON.stringify(payload),
	});

	return "data" in response ? response.data : response;
}

export async function getMessages(conversationId: string) {
	const response = await apiRequest<{ data: { messages: EncryptedMessage[]; next_cursor: string | null } }>(
		`/conversations/${conversationId}/messages`,
	);

	return response.data.messages;
}

export type LoadedMessage = DecryptedMessage | EncryptedMessage;