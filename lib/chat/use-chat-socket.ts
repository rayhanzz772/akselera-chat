"use client";

import { useEffect, useRef, type RefObject } from "react";
import { getAuthToken } from "@/lib/api/client";
import type { Presence } from "@/lib/presence/store";
import { io, type Socket } from "socket.io-client";
import type { EncryptedMessage } from "@/types/chat";

export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8001";

function updateTabBadge(count: number) {
	if (typeof document === "undefined") return;
	document.title = count > 0 ? `(${count}) Akselera Chat` : "Akselera Chat";
}

export type ConversationUpdatedEvent = {
	conversation_id: string;
	last_message: EncryptedMessage;
	updated_at: string;
	unread_count: number;
};

type ChatSocketHandlers = {
	onConnectError?: (message: string) => void;
	onJoinError?: (message: string) => void;
	onPresenceSync?: (presence: Presence[]) => void;
	onPresenceUpdate?: (presence: Presence) => void;
	onConversationUpdated?: (event: ConversationUpdatedEvent) => void | Promise<void>;
	onMessageNew?: (message: EncryptedMessage) => void | Promise<void>;
};

type UseChatSocketOptions = ChatSocketHandlers & {
	userId: string | number | null;
	roomId: string | null;
};

export function useChatSocket({
	userId,
	roomId,
	onConnectError,
	onJoinError,
	onPresenceSync,
	onPresenceUpdate,
	onConversationUpdated,
	onMessageNew,
}: UseChatSocketOptions): RefObject<Socket | null> {
	const socketRef = useRef<Socket | null>(null);
	const handlersRef = useRef<ChatSocketHandlers>({});

	useEffect(() => {
		handlersRef.current = { onConnectError, onJoinError, onPresenceSync, onPresenceUpdate, onConversationUpdated, onMessageNew };
	});

	useEffect(() => {
		if (!userId) {
			updateTabBadge(0);
			return;
		}

		const token = getAuthToken();
		const socket = io(SOCKET_URL, {
			auth: token ? { token } : undefined,
			withCredentials: true,
		});
		socketRef.current = socket;

		socket.on("connect_error", (error) => {
			handlersRef.current.onConnectError?.(error.message);
		});

		socket.on("presence:sync", (event: { presence?: Presence[] }) => {
			if (Array.isArray(event?.presence)) handlersRef.current.onPresenceSync?.(event.presence);
		});

		socket.on("presence:update", (presence: Presence) => {
			if (presence?.user_id) handlersRef.current.onPresenceUpdate?.(presence);
		});

		socket.on("conversation:updated", (event: ConversationUpdatedEvent) => {
			void handlersRef.current.onConversationUpdated?.(event);
		});

		socket.on("unread:sync", (event: { total_unread: number }) => updateTabBadge(event.total_unread));
		socket.on("unread:updated", (event: { total_unread: number }) => updateTabBadge(event.total_unread));

		return () => {
			socketRef.current = null;
			socket.disconnect();
			updateTabBadge(0);
		};
	}, [userId]);

	useEffect(() => {
		const socket = socketRef.current;
		if (!socket || !roomId) return;

		function join() {
			socket?.emit("conversation:join", roomId, (response: { success: boolean; message?: string }) => {
				if (!response.success) {
					handlersRef.current.onJoinError?.(response.message || "Could not join conversation.");
				}
			});
		}

		function handleMessage(message: EncryptedMessage) {
			if (message.conversation_id !== roomId) return;
			void handlersRef.current.onMessageNew?.(message);
		}

		if (socket.connected) join();
		socket.on("connect", join);
		socket.on("message:new", handleMessage);

		return () => {
			socket.off("connect", join);
			socket.off("message:new", handleMessage);
			socket.emit("conversation:leave", roomId);
		};
	}, [userId, roomId]);

	return socketRef;
}

export function requestPresence(socket: Socket | null, userIds: string[], onResult: (presence: Presence[]) => void) {
	socket?.emit(
		"presence:get",
		userIds,
		(response: { success?: boolean; presence?: Presence[] }) => {
			if (response?.success && Array.isArray(response.presence)) onResult(response.presence);
		},
	);
}
