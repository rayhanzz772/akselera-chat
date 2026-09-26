"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { clearAuthToken, getCurrentUser } from "@/lib/api/auth";
import { getConversations } from "@/lib/api/conversations";
import { mapConversationWithPreview, uniqueById } from "@/lib/chat/rooms";
import { getPrivateKey, restoreSessionKeys } from "@/lib/crypto/session";
import { seedPresence } from "@/lib/presence/store";
import type { Room } from "@/types/chat";

export type BootstrapUser = {
	id: string | number;
	name: string;
};

export type ChatBootstrap = {
	user: BootstrapUser | null;
	rooms: Room[];
	setRooms: Dispatch<SetStateAction<Room[]>>;
	isLoading: boolean;
};

export function useChatBootstrap(): ChatBootstrap {
	const router = useRouter();
	const [user, setUser] = useState<BootstrapUser | null>(null);
	const [rooms, setRooms] = useState<Room[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let isCancelled = false;

		void (async () => {
			try {
				const [currentUser, response] = await Promise.all([getCurrentUser(), getConversations()]);
				await restoreSessionKeys();

				const conversations = uniqueById(response.data);
				const privateKey = getPrivateKey();
				const loadedRooms = await Promise.all(
					conversations.map((conversation) => mapConversationWithPreview(conversation, privateKey)),
				);
				if (isCancelled) return;

				seedPresence(conversations.map((conversation) => conversation.opponent).filter(Boolean));

				setUser(currentUser);
				setRooms(loadedRooms);
			} catch {
				if (isCancelled) return;

				clearAuthToken();
				router.replace("/login");
			} finally {
				if (!isCancelled) setIsLoading(false);
			}
		})();

		return () => {
			isCancelled = true;
		};
	}, [router]);

	return { user, rooms, setRooms, isLoading };
}
