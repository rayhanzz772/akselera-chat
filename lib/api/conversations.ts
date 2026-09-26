import { apiRequest } from "./client";
import type { ConversationsResponse } from "@/types/chat";
import type { Conversation } from "@/types/chat";

export function getConversations() {
	return apiRequest<ConversationsResponse>("/conversations");
}

export async function createConversation(email: string) {
	const response = await apiRequest<Conversation | { data: Conversation }>("/conversations", {
		method: "POST",
		body: JSON.stringify({ member_email: email }),
	});

	return "data" in response ? response.data : response;
}