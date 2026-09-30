"use client";

import { useCallback, useEffect, useRef, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { clearAuthToken } from "@/lib/api/auth";
import { deleteConversation, getConversations, markConversationRead } from "@/lib/api/conversations";
import { createMessage, getMessages } from "@/lib/api/messages";
import { appendMessages, dropMessages, EMPTY_MESSAGES, replaceMessages, type MessagesByRoom } from "@/lib/chat/messages";
import { ENCRYPTED_PLACEHOLDER, mapConversationWithPreview, messageSummary, promoteRoom, updateRoom } from "@/lib/chat/rooms";
import { useChatBootstrap } from "@/lib/chat/use-chat-bootstrap";
import { requestPresence, useChatSocket, type ConversationUpdatedEvent } from "@/lib/chat/use-chat-socket";
import { decryptMessage, decryptMessages, encryptMessage } from "@/lib/crypto/messages";
import { clearPrivateKey, getPrivateKey, getPublicKey, setPublicKey } from "@/lib/crypto/session";
import { getPublicKeyFromPrivateKey } from "@/lib/crypto/user-keys";
import { formatConversationTime } from "@/lib/format/datetime";
import { replacePresence, setPresence } from "@/lib/presence/store";
import { Header } from "@/components/ui/header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { isAnyDialogOpen } from "@/components/ui/dialog";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ConversationList } from "@/components/chat/conversation-list";
import { type MessageListHandle } from "@/components/chat/message-list";
import { NewConversationDialog } from "@/components/chat/new-conversation-dialog";
import type { EncryptedMessage, ReplyTarget, Room } from "@/types/chat";
import { LoaderCircle } from "lucide-react";

export default function ChatPage() {
	const router = useRouter();
	const { user, rooms, setRooms, isLoading: isLoadingUser } = useChatBootstrap();
	const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
	const [messagesByRoom, setMessagesByRoom] = useState<MessagesByRoom>({});
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [message, setMessage] = useState("");
	const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
	const [messageError, setMessageError] = useState("");
	const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
	const messageListRef = useRef<MessageListHandle | null>(null);
	const isSendingRef = useRef(false);

	const userId = user?.id ?? null;
	const userName = user?.name ?? "";
	const selectedRoomId = selectedRoom?.id ?? null;
	const visibleMessages = selectedRoom ? messagesByRoom[selectedRoom.id] ?? EMPTY_MESSAGES : EMPTY_MESSAGES;

	const socketRef = useChatSocket({
		userId,
		roomId: selectedRoomId,
		onConnectError: (error) => setMessageError(`Socket authentication failed: ${error}`),
		onJoinError: setMessageError,
		onPresenceSync: replacePresence,
		onPresenceUpdate: (presence) => setPresence([presence]),
		onConversationUpdated: handleConversationUpdated,
		onMessageNew: handleIncomingMessage,
	});

	useEffect(() => {
		if (!selectedRoomId) return;

		let isCurrent = true;

		void (async () => {
			setIsLoadingMessages(true);

			try {
				const encryptedMessages = await getMessages(selectedRoomId);
				const decryptedMessages = await decryptMessages(encryptedMessages, getPrivateKey());
				if (!isCurrent) return;

				setMessagesByRoom((current) => replaceMessages(current, selectedRoomId, decryptedMessages));
				const latest = decryptedMessages.at(-1);
				if (latest) {
					setRooms((currentRooms) => updateRoom(currentRooms, selectedRoomId, messageSummary(latest, 0)));
				}
			} catch (loadingError) {
				if (isCurrent) setMessageError(loadingError instanceof Error ? loadingError.message : "Messages could not be loaded.");
			} finally {
				if (isCurrent) setIsLoadingMessages(false);
			}
		})();

		return () => {
			isCurrent = false;
		};
	}, [selectedRoomId, setRooms]);

	useEffect(() => {
		if (!selectedRoom) return;

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key !== "Escape" || isAnyDialogOpen()) return;

			setReplyTarget(null);
			setSelectedRoom(null);
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedRoom]);

	async function handleConversationUpdated(event: ConversationUpdatedEvent) {
		const currentPrivateKey = getPrivateKey();
		let preview = ENCRYPTED_PLACEHOLDER;
		if (currentPrivateKey) {
			try {
				preview = await decryptMessage(event.last_message, currentPrivateKey);
			} catch {
			}
		}

		let newRoom: Room | undefined;
		if (!rooms.some((room) => room.id === event.conversation_id)) {
			try {
				const response = await getConversations();
				const conversation = response.data.find((item) => item.id === event.conversation_id);
				if (!conversation) return;
				newRoom = await mapConversationWithPreview(conversation, currentPrivateKey);
			} catch (loadingError) {
				setMessageError(loadingError instanceof Error ? loadingError.message : "Conversations could not be loaded.");
				return;
			}
		}

		setRooms((currentRooms) => {
			const updatedRoom = currentRooms.find((room) => room.id === event.conversation_id) ?? newRoom;
			if (!updatedRoom) return currentRooms;

			return promoteRoom(currentRooms, {
				...updatedRoom,
				preview,
				time: formatConversationTime(event.updated_at),
				unreadCount: event.unread_count,
			});
		});
	}

	async function handleIncomingMessage(newMessage: EncryptedMessage) {
		const [decryptedMessage] = await decryptMessages([newMessage], getPrivateKey());
		setMessagesByRoom((current) => appendMessages(current, newMessage.conversation_id, [decryptedMessage]));
		setRooms((currentRooms) => updateRoom(currentRooms, newMessage.conversation_id, messageSummary(decryptedMessage, 0)));
	}

	const handleRequestPresence = useCallback((userIds: string[]) => {
		requestPresence(socketRef.current, userIds, setPresence);
	}, [socketRef, setRooms]);

	const handleConversationCreated = useCallback((result: { rooms: Room[]; room: Room }) => {
		setRooms(result.rooms);
		setReplyTarget(null);
		setSelectedRoom(result.room);
		setIsNewConversationOpen(false);
	}, []);

	async function handleSelectRoom(room: Room) {
		setReplyTarget(null);
		setSelectedRoom(room);
		setRooms((currentRooms) => updateRoom(currentRooms, room.id, { unreadCount: 0 }));

		try {
			await markConversationRead(room.id);
		} catch (readError) {
			setMessageError(readError instanceof Error ? readError.message : "Conversation could not be marked as read.");
		}
	}

	function handleDeleteConversation() {
		if (!selectedRoom) return;
		setIsDeleteDialogOpen(true);
	}

	async function confirmDeleteConversation() {
		if (!selectedRoom) return;

		try {
			await deleteConversation(selectedRoom.id);
			setRooms((currentRooms) => currentRooms.filter((room) => room.id !== selectedRoom.id));
			setMessagesByRoom((current) => dropMessages(current, selectedRoom.id));
			setReplyTarget(null);
			setSelectedRoom(null);
			setMessageError("");
			setIsDeleteDialogOpen(false);
		} catch (deleteError) {
			setMessageError(deleteError instanceof Error ? deleteError.message : "Conversation could not be deleted.");
		}
	}

	async function handleSend(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (isSendingRef.current) return;

		setMessageError("");
		if (!message.trim() || !selectedRoom) return;
		if (!selectedRoom.publicKey) {
			setMessageError("The recipient encryption key is unavailable.");
			return;
		}

		isSendingRef.current = true;
		setIsSending(true);

		try {
			const currentPrivateKey = getPrivateKey();
			const senderPublicKey = getPublicKey() ?? (currentPrivateKey
				? await getPublicKeyFromPrivateKey(currentPrivateKey)
				: null);
			if (!senderPublicKey) {
				setMessageError("Your encryption key is unavailable. Please log in again.");
				return;
			}
			setPublicKey(senderPublicKey);

			const encryptedMessage = await encryptMessage(message.trim(), selectedRoom.publicKey, senderPublicKey);
			const createdMessage = await createMessage(selectedRoom.id, {
				...encryptedMessage,
				reply_to_message_id: replyTarget?.id ?? null,
			});
			const [visibleMessage] = await decryptMessages([createdMessage], getPrivateKey());

			setMessagesByRoom((current) => appendMessages(current, selectedRoom.id, [visibleMessage]));
			setRooms((currentRooms) => updateRoom(currentRooms, selectedRoom.id, messageSummary(visibleMessage, 0)));
			setMessage("");
			setReplyTarget(null);
			messageListRef.current?.scrollToBottom();
		} catch (submissionError) {
			setMessageError(submissionError instanceof Error ? submissionError.message : "Message could not be sent.");
		} finally {
			isSendingRef.current = false;
			setIsSending(false);
		}
	}

	function confirmLogout() {
		clearAuthToken();
		clearPrivateKey();
		setIsLogoutDialogOpen(false);
		router.replace("/login");
	}

	return (
		<main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
			<Header
				userName={userName || undefined}
				onLogout={() => setIsLogoutDialogOpen(true)}
				className={selectedRoom ? "max-md:hidden" : ""}
			/>

			{isLoadingUser ? (
				<div role="status" className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground">
					<LoaderCircle className="size-8 animate-spin" aria-hidden="true" />
					<span>Loading your chats...</span>
				</div>
			) : (
				<div className="mx-auto flex min-h-0 w-full flex-1 overflow-hidden border-y bg-card">
					<ConversationList
						rooms={rooms}
						selectedRoomId={selectedRoom?.id}
						isHidden={Boolean(selectedRoom)}
						onSelectRoom={(room) => void handleSelectRoom(room)}
						onCreateConversation={() => setIsNewConversationOpen(true)}
					/>
					<ChatPanel
						room={selectedRoom}
						userId={userId}
						messages={visibleMessages}
						isLoadingMessages={isLoadingMessages}
						message={message}
						userName={userName}
						replyTarget={replyTarget}
						onReply={setReplyTarget}
						onCancelReply={() => setReplyTarget(null)}
						onMessageChange={setMessage}
						onSend={(event) => void handleSend(event)}
						isSending={isSending}
						messageError={messageError}
						onBack={() => {
							setReplyTarget(null);
							setSelectedRoom(null);
						}}
						onDelete={handleDeleteConversation}
						messageListRef={messageListRef}
					/>
				</div>
			)}

			<NewConversationDialog
				open={isNewConversationOpen}
				onOpenChange={setIsNewConversationOpen}
				onCreated={handleConversationCreated}
				onRequestPresence={handleRequestPresence}
			/>

			<ConfirmDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
				title="Delete conversation?"
				description={`This will remove the conversation with ${selectedRoom?.name ?? "this contact"} from your conversation list.`}
				confirmLabel="Delete conversation"
				onConfirm={() => void confirmDeleteConversation()}
			/>

			<ConfirmDialog
				open={isLogoutDialogOpen}
				onOpenChange={setIsLogoutDialogOpen}
				title="Log out?"
				description="You will be signed out and your private key will be cleared from memory on this device. Log back in to read your messages again."
				confirmLabel="Log out"
				onConfirm={confirmLogout}
			/>
		</main>
	);
}
