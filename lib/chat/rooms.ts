import { decryptMessages } from "@/lib/crypto/messages";
import { formatConversationTime } from "@/lib/format/datetime";
import { initialsFrom } from "@/lib/format/name";
import type { Conversation, DecryptedMessage, EncryptedMessage, Room } from "@/types/chat";

export const ENCRYPTED_PLACEHOLDER = "Encrypted message";

export function uniqueById<T extends { id: string }>(items: T[]) {
	return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function mapConversation(conversation: Conversation): Room {
	const name = conversation.opponent.name;

	return {
		id: conversation.id,
		opponentId: conversation.opponent.id,
		unreadCount: conversation.unread_count ?? 0,
		publicKey: conversation.opponent.public_key,
		initials: initialsFrom(name),
		name,
		preview: conversation.last_message ? ENCRYPTED_PLACEHOLDER : "No messages yet",
		time: formatConversationTime(conversation.last_message?.created_at ?? conversation.created_at),
	};
}

export async function mapConversationWithPreview(
	conversation: Conversation,
	privateKey: CryptoKey | null,
): Promise<Room> {
	const room = mapConversation(conversation);
	const lastMessage = conversation.last_message;
	if (!privateKey || !lastMessage) return room;

	const [decrypted] = await decryptMessages([lastMessage], privateKey);

	return "text" in decrypted ? { ...room, preview: decrypted.text } : room;
}

export function updateRoom(rooms: Room[], roomId: string, changes: Partial<Room>) {
	return rooms.map((room) => (room.id === roomId ? { ...room, ...changes } : room));
}

export function promoteRoom(rooms: Room[], updatedRoom: Room) {
	return [updatedRoom, ...rooms.filter((room) => room.id !== updatedRoom.id)];
}

export function messageSummary(
	payload: EncryptedMessage | DecryptedMessage,
	unreadCount: number,
): Partial<Room> {
	return {
		preview: "text" in payload ? payload.text : ENCRYPTED_PLACEHOLDER,
		time: formatConversationTime(payload.created_at),
		unreadCount,
	};
}
