"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthToken, getCurrentUser } from "@/lib/api/auth";
import { getAuthToken } from "@/lib/api/client";
import { createConversation, deleteConversation, getConversations, markConversationRead } from "@/lib/api/conversations";
import { getUsers } from "@/lib/api/users";
import { createMessage, getMessages, type LoadedMessage } from "@/lib/api/messages";
import { decryptMessage, encryptMessage } from "@/lib/crypto/messages";
import { clearPrivateKey, getPrivateKey, getPublicKey, restoreSessionKeys, setPublicKey } from "@/lib/crypto/session";
import { getPublicKeyFromPrivateKey } from "@/lib/crypto/user-keys";
import { replacePresence, seedPresence, setPresence, type Presence } from "@/lib/presence/store";
import { ArrowLeft, Contact, Trash2 } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { Header } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PresenceDot, PresenceLabel } from "@/components/ui/presence";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Conversation, DecryptedMessage, EncryptedMessage, Room, UserSummary } from "@/types/chat";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8001";

type ConversationUpdatedEvent = {
	conversation_id: string;
	last_message: EncryptedMessage;
	updated_at: string;
	unread_count: number;
};

function formatConversationTime(value: string) {
	const date = new Date(value);
	const now = new Date();

	if (date.toDateString() === now.toDateString()) {
		return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	}

	return "Yesterday";
}

function formatMessageDate(value: string) {
	const date = new Date(value);
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);

	if (date.toDateString() === today.toDateString()) return "Today";
	if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

	return date.toLocaleDateString(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

function formatMessageTime(value: string) {
	return new Date(value).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function uniqueById<T extends { id: string }>(items: T[]) {
	return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function mapConversation(conversation: Conversation): Room {
	const name = conversation.opponent.name;

	return {
		id: conversation.id,
		opponentId: conversation.opponent.id,
		unreadCount: conversation.unread_count ?? 0,
		publicKey: conversation.opponent.public_key,
		initials: name
			.split(" ")
			.map((part) => part[0])
			.join("")
			.slice(0, 2)
			.toUpperCase(),
		name,
		preview: conversation.last_message ? "Encrypted message" : "No messages yet",
		time: formatConversationTime(conversation.last_message?.created_at ?? conversation.created_at),
	};
}

export default function ChatPage() {
	const router = useRouter();
	const [isDark, setIsDark] = useState(false);
	const [search, setSearch] = useState("");
	const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
	const [message, setMessage] = useState("");
	const [messageError, setMessageError] = useState("");
	const [userName, setUserName] = useState("");
	const [userId, setUserId] = useState<string | number | null>(null);
	const [isLoadingUser, setIsLoadingUser] = useState(true);
	const [rooms, setRooms] = useState<Room[]>([]);
	const [messages, setMessages] = useState<LoadedMessage[]>([]);
	const [messagesConversationId, setMessagesConversationId] = useState<string | null>(null);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
	const [userSearch, setUserSearch] = useState("");
	const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
	const [users, setUsers] = useState<UserSummary[]>([]);
	const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [conversationError, setConversationError] = useState("");
	const [isCreatingConversation, setIsCreatingConversation] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
	const messagesContainerRef = useRef<HTMLDivElement | null>(null);
	const isNearBottomRef = useRef(true);
	const userSocketRef = useRef<Socket | null>(null);
	const isDialogOpen = isNewConversationOpen || isDeleteDialogOpen || isLogoutDialogOpen;

	useEffect(() => {
		Promise.all([getCurrentUser(), getConversations()])
			.then(async ([user, response]) => {
				// Semai presence dari REST SEBELUM socket tersambung. Kalau urutannya
				// terbalik, `presence:update` yang lebih baru bisa tertimpa data REST
				// yang lebih lama.
				seedPresence(response.data.map((conversation) => conversation.opponent).filter(Boolean));

				setUserName(user.name);
				setUserId(user.id);
				await restoreSessionKeys();
				const currentPrivateKey = getPrivateKey();
				const initialRooms = uniqueById(response.data.map(mapConversation));
				const roomsWithPreviews = await Promise.all(initialRooms.map(async (room) => {
					if (!currentPrivateKey) return room;

					try {
						const encryptedMessages = await getMessages(room.id);
						const latestMessage = encryptedMessages.at(-1);
						if (!latestMessage) return room;

						return {
							...room,
							preview: await decryptMessage(latestMessage, currentPrivateKey),
							time: formatConversationTime(latestMessage.created_at),
						};
					} catch {
						return room;
					}
				}));

				setRooms(roomsWithPreviews);
			})
			.catch(() => {
				clearAuthToken();
				router.replace("/login");
			})
			.finally(() => setIsLoadingUser(false));
	}, [router]);

	useEffect(() => {
		if (!userId) return;

		let isCurrent = true;
		const token = getAuthToken();
		const userSocket = io(SOCKET_URL, {
			auth: token ? { token } : undefined,
			withCredentials: true,
		});
		userSocketRef.current = userSocket;

		userSocket.on("connect_error", (error) => {
			if (isCurrent) setMessageError(`Socket authentication failed: ${error.message}`);
		});

		// Server otomatis memasukkan socket ini ke room `user:<id>`, jadi event
		// presence datang tanpa perlu `conversation:join`. Payload `presence:sync`
		// otoritatif dan harus menimpa store, bukan digabung.
		userSocket.on("presence:sync", (event: { presence?: Presence[] }) => {
			if (!isCurrent || !Array.isArray(event?.presence)) return;
			replacePresence(event.presence);
		});

		userSocket.on("presence:update", (presence: Presence) => {
			if (!isCurrent || !presence?.user_id) return;
			setPresence([presence]);
		});

		userSocket.on("conversation:updated", async (event: ConversationUpdatedEvent) => {
			if (!isCurrent) return;

			const currentPrivateKey = getPrivateKey();
			let preview = "Encrypted message";
			if (currentPrivateKey) {
				try {
					preview = await decryptMessage(event.last_message, currentPrivateKey);
				} catch {
					// Keep the encrypted fallback when this client cannot decrypt the event.
				}
			}

			setRooms((currentRooms) => {
				const updatedRoom = currentRooms.find((room) => room.id === event.conversation_id);
				if (!updatedRoom) return currentRooms;

				return [
					{ ...updatedRoom, preview, time: formatConversationTime(event.updated_at), unreadCount: event.unread_count },
					...currentRooms.filter((room) => room.id !== event.conversation_id),
				];
			});
		});

		return () => {
			isCurrent = false;
			userSocketRef.current = null;
			userSocket.disconnect();
		};
	}, [userId]);

	async function handleSelectRoom(room: Room) {
		isNearBottomRef.current = true;
		setSelectedRoom(room);
		setRooms((currentRooms) => currentRooms.map((currentRoom) => currentRoom.id === room.id
			? { ...currentRoom, unreadCount: 0 }
			: currentRoom));

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
			setSelectedRoom(null);
			setMessages([]);
			setMessagesConversationId(null);
			setMessageError("");
			setIsDeleteDialogOpen(false);
		} catch (deleteError) {
			setMessageError(deleteError instanceof Error ? deleteError.message : "Conversation could not be deleted.");
		}
	}

	useEffect(() => {
		if (!selectedRoom) {
			return;
		}
		const conversationId = selectedRoom.id;

		let isCurrent = true;
		let socket: Socket | null = null;

		async function decryptMessages(encryptedMessages: EncryptedMessage[]) {
			const currentPrivateKey = getPrivateKey();
			return Promise.all(encryptedMessages.map(async (encryptedMessage) => {
				if (!currentPrivateKey) return encryptedMessage;

				try {
					return {
						...encryptedMessage,
						text: await decryptMessage(encryptedMessage, currentPrivateKey),
					} satisfies DecryptedMessage;
				} catch {
					return encryptedMessage;
				}
			}));
		}

		async function loadHistory() {
			setIsLoadingMessages(true);

			try {
				const encryptedMessages = await getMessages(conversationId);
				const decryptedMessages = await decryptMessages(encryptedMessages);
				if (!isCurrent) return;

				setMessages(uniqueById(decryptedMessages));
				setMessagesConversationId(conversationId);
				const latest = decryptedMessages.at(-1);
				if (latest) {
					setRooms((currentRooms) => currentRooms.map((room) => room.id === conversationId
						? { ...room, preview: "text" in latest ? latest.text : "Encrypted message", time: formatConversationTime(latest.created_at), unreadCount: 0 }
						: room));
				}
			} catch (loadingError) {
				if (isCurrent) setMessageError(loadingError instanceof Error ? loadingError.message : "Messages could not be loaded.");
			} finally {
				if (isCurrent) setIsLoadingMessages(false);
			}
			if (!isCurrent) return;

			const token = getAuthToken();
			socket = io(SOCKET_URL, {
				auth: token ? { token } : undefined,
				withCredentials: true,
			});

			socket.on("connect_error", (error) => {
				if (isCurrent) setMessageError(`Socket authentication failed: ${error.message}`);
			});

			socket.on("connect", () => {
				socket?.emit("conversation:join", conversationId, (response: { success: boolean; conversation_id?: string; message?: string }) => {
					if (isCurrent && !response.success) setMessageError(response.message || "Could not join conversation.");
				});
			});

			socket.on("message:new", async (newMessage: EncryptedMessage) => {
				if (!isCurrent || newMessage.conversation_id !== conversationId) return;

				const [decryptedMessage] = await decryptMessages([newMessage]);
				setMessages((currentMessages) => uniqueById([...currentMessages, decryptedMessage]));
				setRooms((currentRooms) => currentRooms.map((room) => room.id === conversationId
					? { ...room, preview: "text" in decryptedMessage ? decryptedMessage.text : "Encrypted message", time: formatConversationTime(newMessage.created_at), unreadCount: 0 }
					: room));
			});
		}

		void loadHistory();

		return () => {
			isCurrent = false;
			if (socket) {
				socket.emit("conversation:leave", conversationId);
				socket.disconnect();
			}
		};
	}, [selectedRoom]);

	const visibleMessages = selectedRoom && messagesConversationId === selectedRoom.id ? messages : [];

	const filteredRooms = useMemo(
		() => rooms.filter((room) => room.name.toLowerCase().includes(search.toLowerCase())),
		[rooms, search],
	);

	const filteredUsers = useMemo(() => {
		const query = debouncedUserSearch.trim().toLowerCase();
		if (!query) return [];
		return users.filter((user) => user.email.toLowerCase().includes(query) || user.name.toLowerCase().includes(query));
	}, [debouncedUserSearch, users]);

	useEffect(() => {
		const timeout = window.setTimeout(() => setDebouncedUserSearch(userSearch), 300);

		return () => window.clearTimeout(timeout);
	}, [userSearch]);

	useEffect(() => {
		const container = messagesContainerRef.current;
		if (!container) return;

		// Jangan tarik paksa ke bawah kalau pengguna sedang membaca pesan lama.
		if (!isNearBottomRef.current) return;

		container.scrollTop = container.scrollHeight;
	}, [messages, messagesConversationId]);

	function handleMessagesScroll() {
		const container = messagesContainerRef.current;
		if (!container) return;

		isNearBottomRef.current =
			container.scrollHeight - container.scrollTop - container.clientHeight < 80;
	}

	useEffect(() => {
		if (!selectedRoom) return;

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key !== "Escape") return;
			// Biarkan dialog yang menangani Escape-nya sendiri.
			if (isDialogOpen) return;

			setSelectedRoom(null);
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedRoom, isDialogOpen]);

	async function handleSend(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessageError("");
		if (!message.trim() || !selectedRoom) return;
		if (!selectedRoom.publicKey) {
			setMessageError("The recipient encryption key is unavailable.");
			return;
		}
		const currentPrivateKey = getPrivateKey();
		const senderPublicKey = getPublicKey() ?? (currentPrivateKey
			? await getPublicKeyFromPrivateKey(currentPrivateKey)
			: null);
		if (!senderPublicKey) {
			setMessageError("Your encryption key is unavailable. Please log in again.");
			return;
		}
		setPublicKey(senderPublicKey);

		try {
			const encryptedMessage = await encryptMessage(message.trim(), selectedRoom.publicKey, senderPublicKey);
			const createdMessage = await createMessage(selectedRoom.id, encryptedMessage);
			const currentPrivateKey = getPrivateKey();
			let visibleMessage: LoadedMessage = createdMessage;
			if (currentPrivateKey) {
				try {
					visibleMessage = { ...createdMessage, text: await decryptMessage(createdMessage, currentPrivateKey) };
				} catch {
				}
			}
			isNearBottomRef.current = true;
			setMessages((currentMessages) => uniqueById([...currentMessages, visibleMessage]));
			setRooms((currentRooms) => currentRooms.map((room) => room.id === selectedRoom.id
				? { ...room, preview: "text" in visibleMessage ? visibleMessage.text : "Encrypted message", time: formatConversationTime(createdMessage.created_at), unreadCount: 0 }
				: room));
			setMessage("");
		} catch (submissionError) {
			setMessageError(submissionError instanceof Error ? submissionError.message : "Message could not be sent.");
		}
	}

	async function handleCreateConversation(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedUser) {
			setConversationError("Select a user first.");
			return;
		}

		setConversationError("");
		setIsCreatingConversation(true);

		try {
			await createConversation(selectedUser.email);
			const refreshedConversations = await getConversations();
			const refreshedRooms = uniqueById(refreshedConversations.data.map(mapConversation));
			const room = refreshedRooms.find((conversationRoom) => conversationRoom.opponentId === selectedUser.id);

			if (!room) {
				throw new Error("Conversation created, but it was not returned by the conversations list.");
			}

			setRooms(refreshedRooms);
			setSelectedRoom(room);
			setUserSearch("");
			setSelectedUser(null);
			setIsNewConversationOpen(false);
		} catch (creationError) {
			setConversationError(
				creationError instanceof Error ? creationError.message : "Conversation could not be created.",
			);
		} finally {
			setIsCreatingConversation(false);
		}
	}

	async function handleOpenNewConversation() {
		setConversationError("");
		setSelectedUser(null);
		setUserSearch("");
		setIsNewConversationOpen(true);
		setIsLoadingUsers(true);

		try {
			const fetchedUsers = (await getUsers()).data;
			setUsers(fetchedUsers);
			seedPresence(fetchedUsers);

			// `presence:sync` hanya mencakup lawan bicara di daftar conversation,
			// jadi hasil pencarian user harus ditanyakan eksplisit.
			const userIds = fetchedUsers.map((user) => String(user.id));
			userSocketRef.current?.emit(
				"presence:get",
				userIds,
				(response: { success?: boolean; presence?: Presence[] }) => {
					if (response?.success && Array.isArray(response.presence)) {
						setPresence(response.presence);
					}
				},
			);
		} catch (usersError) {
			setConversationError(usersError instanceof Error ? usersError.message : "Users could not be loaded.");
		} finally {
			setIsLoadingUsers(false);
		}
	}

	function confirmLogout() {
		clearAuthToken();
		clearPrivateKey();
		setIsLogoutDialogOpen(false);
		router.replace("/login");
	}

	return (
		<main className={`flex h-dvh flex-col overflow-hidden bg-background text-foreground${isDark ? " dark" : ""}`}>
			<Header
				isDark={isDark}
				onThemeChange={() => setIsDark((current) => !current)}
				userName={userName || "Loading..."}
				onLogout={() => setIsLogoutDialogOpen(true)}
				className={selectedRoom ? "max-md:hidden" : ""}
			/>

			{isLoadingUser ? (
				<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
					Loading your chats...
				</div>
			) : <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 overflow-hidden border-y bg-card">
				<aside className={`min-h-0 w-full shrink-0 flex-col border-r md:flex md:max-w-sm md:w-[34%] ${selectedRoom ? "hidden" : "flex"}`}>
					<div className="flex items-center gap-2 p-6">
						<Input
							aria-label="Search chats"
							placeholder="Cari chat"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							className="h-12 rounded-full px-5"
						/>
						<Button type="button" className="h-12 shrink-0 rounded-full px-4" onClick={handleOpenNewConversation}>
                            <div className="flex items-center gap-2">
                                +
							    <span className="hidden sm:inline">Chat baru</span>
                            </div>
						</Button>
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
						{filteredRooms.map((room) => (
							<button
								key={room.id}
								type="button"
								onClick={() => void handleSelectRoom(room)}
								className={`flex w-full cursor-pointer items-center gap-4 rounded-lg px-3 py-4 text-left transition-colors hover:bg-muted ${selectedRoom?.id === room.id ? "bg-muted" : ""}`}
							>
								<span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold">
									{room.initials}
									<PresenceDot userId={room.opponentId} />
								</span>
								<span className="min-w-0 flex-1">
									<span className="flex items-center justify-between gap-2">
										<span className="truncate text-base font-semibold">{room.name}</span>
										<span className="shrink-0 text-xs text-muted-foreground">{room.time}</span>
									</span>
									<span className="mt-1 flex items-center justify-between gap-2">
										<span className="block truncate text-sm text-muted-foreground">{room.preview}</span>
										{room.unreadCount > 0 && (
                                        <span
                                            className={`flex h-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background ${
                                            room.unreadCount < 10 ? "w-5" : "min-w-5 px-1.5"
                                            }`}
                                        >
                                            {room.unreadCount}
                                        </span>
                                        )}
									</span>
								</span>
							</button>
						))}
						{filteredRooms.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No chats found.</p>}
					</div>
				</aside>

				<section className={`min-h-0 min-w-0 flex-1 flex-col md:flex ${selectedRoom ? "flex" : "hidden"}`}>
					{selectedRoom ? (
						<>
							<div className="flex items-center justify-between gap-3 border-b px-4 py-5 md:px-8">
								<div className="flex items-center gap-3">
									<Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedRoom(null)} aria-label="Back to conversations" title="Back to conversations">
										<ArrowLeft className="size-4" />
									</Button>
									<span className="relative flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
										{selectedRoom.initials}
										<PresenceDot userId={selectedRoom.opponentId} />
									</span>
									<div>
										<h1 className="font-semibold">{selectedRoom.name}</h1>
										<PresenceLabel userId={selectedRoom.opponentId} fallback="Active conversation" />
									</div>
								</div>
								<Button type="button" variant="ghost" size="icon" onClick={() => void handleDeleteConversation()} aria-label="Delete conversation" title="Delete conversation">
									<Trash2 className="size-4" />
								</Button>
							</div>
							<div
								ref={messagesContainerRef}
								onScroll={handleMessagesScroll}
								className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain bg-muted/30 p-4 md:p-8"
							>
								{isLoadingMessages && <p className="text-sm text-muted-foreground">Loading messages...</p>}
								{!isLoadingMessages && visibleMessages.length === 0 && <p className="text-sm text-muted-foreground">Start a secure conversation with {selectedRoom.name}.</p>}
								{visibleMessages.map((chatMessage, index) => {
									const previousMessage = visibleMessages[index - 1];
									const isNewDate = !previousMessage || new Date(previousMessage.created_at).toDateString() !== new Date(chatMessage.created_at).toDateString();

									return (
										<div key={chatMessage.id} className="shrink-0 space-y-3">
											{isNewDate && <div className="py-3 text-center text-xs font-medium text-muted-foreground">{formatMessageDate(chatMessage.created_at)}</div>}
															<div className={`flex ${String(chatMessage.sender_id) === String(userId) ? "justify-end" : "justify-start"}`}>
																<div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm shadow-sm ${String(chatMessage.sender_id) === String(userId) ? "bg-foreground text-background" : "bg-bubble"}`}>
																	<p className="whitespace-pre-wrap wrap-anywhere">{"text" in chatMessage ? chatMessage.text : "Encrypted message"}</p>
																	<time className={`mt-2 block text-right text-[11px] ${String(chatMessage.sender_id) === String(userId) ? "text-background/70" : "text-muted-foreground"}`} dateTime={chatMessage.created_at}>
																		{formatMessageTime(chatMessage.created_at)}
																	</time>
																</div>
											</div>
										</div>
									);
								})}
							</div>
							<form onSubmit={handleSend} className="flex gap-3 border-t p-5">
								{messageError && <p className="absolute -mt-12 text-sm text-destructive">{messageError}</p>}
								<Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tulis pesan..." aria-label="Message" />
								<Button type="submit">Send</Button>
							</form>
						</>
					) : (
						<div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
							<Contact className="mb-4 h-24 w-24 text-muted-foreground" />
							<h1 className="text-xl font-semibold">Pilih percakapan atau mulai chat baru</h1>
							<p className="mt-3 max-w-md text-base text-muted-foreground">Daftar hanya berisi percakapan milik akun yang login.</p>
						</div>
					)}
				</section>
			</div>}

			<Dialog open={isNewConversationOpen} onOpenChange={setIsNewConversationOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Start a new conversation</DialogTitle>
						<DialogDescription>Enter the member ID of the person you want to message.</DialogDescription>
					</DialogHeader>

					<form className="mt-6 space-y-4" onSubmit={handleCreateConversation}>
						<div className="space-y-2">
							<label htmlFor="user-email" className="text-sm font-medium">Search by email</label>
							<Input
								id="user-email"
								value={userSearch}
								onChange={(event) => {
									setUserSearch(event.target.value);
									setSelectedUser(null);
								}}
								placeholder="dimas@gmail.com"
								autoFocus
							/>
						</div>

						{isLoadingUsers && <p className="text-sm text-muted-foreground">Loading users...</p>}
						{!isLoadingUsers && filteredUsers.length > 0 && (
							<div className="space-y-2">
								<p className="text-xs text-muted-foreground">Users</p>
								<div className="max-h-48 space-y-1 overflow-y-auto">
									{filteredUsers.map((user) => (
										<Button
											key={user.id}
											type="button"
											variant={selectedUser?.id === user.id ? "default" : "outline"}
											className="h-auto w-full justify-start px-3 py-2 text-left text-xs"
											onClick={() => {
												setSelectedUser(user);
												setUserSearch(user.email);
											}}
										>
											<span className="flex items-center gap-2">
												<span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
													{user.name.slice(0, 2).toUpperCase()}
													<PresenceDot userId={user.id} className="size-2.5" />
												</span>
												<span className="min-w-0">
													<span className="block truncate font-medium">{user.name}</span>
													<span className="block truncate opacity-70">{user.email}</span>
												</span>
											</span>
										</Button>
									))}
								</div>
							</div>
						)}
						{!isLoadingUsers && userSearch && filteredUsers.length === 0 && <p className="text-sm text-muted-foreground">No users found.</p>}

						{conversationError && <p className="text-sm text-red-600 dark:text-red-400">{conversationError}</p>}

						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setIsNewConversationOpen(false)}>Cancel</Button>
							<Button type="submit" disabled={isCreatingConversation}>
								{isCreatingConversation ? "Creating..." : "Create conversation"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete conversation?</DialogTitle>
						<DialogDescription>
							This will remove the conversation with {selectedRoom?.name} from your conversation list.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
						<Button type="button" onClick={() => void confirmDeleteConversation()}>Delete conversation</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Log out?</DialogTitle>
						<DialogDescription>
							You will be signed out and your private key will be cleared from memory on this device. Log back in to read your messages again.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setIsLogoutDialogOpen(false)}>Cancel</Button>
						<Button type="button" onClick={confirmLogout}>Log out</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
}
