import type { LoadedMessage } from "@/lib/api/messages";
import { uniqueById } from "@/lib/chat/rooms";

export type MessagesByRoom = Record<string, LoadedMessage[]>;

export const EMPTY_MESSAGES: LoadedMessage[] = [];

export function replaceMessages(current: MessagesByRoom, roomId: string, messages: LoadedMessage[]): MessagesByRoom {
	return { ...current, [roomId]: uniqueById(messages) };
}

export function appendMessages(current: MessagesByRoom, roomId: string, incoming: LoadedMessage[]): MessagesByRoom {
	return { ...current, [roomId]: uniqueById([...(current[roomId] ?? []), ...incoming]) };
}

export function dropMessages(current: MessagesByRoom, roomId: string): MessagesByRoom {
	const next = { ...current };
	delete next[roomId];
	return next;
}
