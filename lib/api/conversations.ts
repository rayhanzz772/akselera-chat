import { apiRequest } from "./client";
import type { ConversationsResponse } from "@/types/chat";
import type { Conversation } from "@/types/chat";

export function getConversations() {
	return apiRequest<ConversationsResponse>("/conversations");
}

export function markConversationRead(conversationId: string) {
	return apiRequest<{ conversation_id: string; unread_count: number }>(`/conversations/${conversationId}/read`, {
		method: "PATCH",
	});
}

export function deleteConversation(conversationId: string) {
	return apiRequest<{ conversation_id: string }>(`/conversations/${conversationId}`, {
		method: "DELETE",
	});
}

export async function createConversation(email: string) {
	const response = await apiRequest<Conversation | { data: Conversation }>("/conversations", {
		method: "POST",
		body: JSON.stringify({ member_email: email }),
	});

	return "data" in response ? response.data : response;
}