"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthToken, getCurrentUser } from "@/lib/api/auth";
import { createConversation, getConversations } from "@/lib/api/conversations";
import { getUsers } from "@/lib/api/users";
import { createMessage, getMessages, type LoadedMessage } from "@/lib/api/messages";
import { decryptMessage, encryptMessage } from "@/lib/crypto/messages";
import { clearPrivateKey, getPrivateKey, getPublicKey, restoreSessionKeys, setPublicKey } from "@/lib/crypto/session";
import { getPublicKeyFromPrivateKey } from "@/lib/crypto/user-keys";
import { Header } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Conversation, DecryptedMessage, Room, UserSummary } from "@/types/chat";

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

function mapConversation(conversation: Conversation): Room {
	const name = conversation.opponent.name;

	return {
		id: conversation.id,
		opponentId: conversation.opponent.id,
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

	useEffect(() => {
		Promise.all([getCurrentUser(), getConversations()])
			.then(async ([user, response]) => {
				setUserName(user.name);
				setUserId(user.id);
				await restoreSessionKeys();
				const currentPrivateKey = getPrivateKey();
				const initialRooms = response.data.map(mapConversation);
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
		if (!selectedRoom) {
			return;
		}

		let isCurrent = true;

		getMessages(selectedRoom.id)
			.then(async (encryptedMessages) => {
				const currentPrivateKey = getPrivateKey();
				const decryptedMessages = await Promise.all(encryptedMessages.map(async (encryptedMessage) => {
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

				if (!isCurrent) return;
				setMessages(decryptedMessages);
				setMessagesConversationId(selectedRoom.id);
				const latest = decryptedMessages.at(-1);
				if (latest) {
					setRooms((currentRooms) => currentRooms.map((room) => room.id === selectedRoom.id
						? { ...room, preview: "text" in latest ? latest.text : "Encrypted message", time: formatConversationTime(latest.created_at) }
						: room));
				}
			})
			.catch((loadingError) => {
				if (isCurrent) setMessageError(loadingError instanceof Error ? loadingError.message : "Messages could not be loaded.");
			})
			.finally(() => {
				if (isCurrent) setIsLoadingMessages(false);
			});

		return () => {
			isCurrent = false;
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
			setMessages((currentMessages) => [...currentMessages, visibleMessage]);
			setRooms((currentRooms) => currentRooms.map((room) => room.id === selectedRoom.id
				? { ...room, preview: "text" in visibleMessage ? visibleMessage.text : "Encrypted message", time: formatConversationTime(createdMessage.created_at) }
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
			const refreshedRooms = refreshedConversations.data.map(mapConversation);
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
			setUsers((await getUsers()).data);
		} catch (usersError) {
			setConversationError(usersError instanceof Error ? usersError.message : "Users could not be loaded.");
		} finally {
			setIsLoadingUsers(false);
		}
	}

	return (
		<main className={isDark ? "dark min-h-screen bg-background text-foreground" : "min-h-screen bg-background text-foreground"}>
			<Header
				isDark={isDark}
				onThemeChange={() => setIsDark((current) => !current)}
				userName={userName || "Loading..."}
				onLogout={() => {
					clearAuthToken();
					clearPrivateKey();
					router.replace("/login");
				}}
			/>

			{isLoadingUser ? (
				<div className="flex h-[calc(100vh-104px)] items-center justify-center text-sm text-muted-foreground">
					Loading your chats...
				</div>
			) : <div className="mx-auto flex h-[calc(100vh-104px)] w-full max-w-6xl overflow-hidden border-y bg-card">
				<aside className="flex w-full max-w-sm shrink-0 flex-col border-r md:w-[34%]">
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

					<div className="overflow-y-auto px-3 pb-4">
						{filteredRooms.map((room) => (
							<button
								key={room.id}
								type="button"
								onClick={() => setSelectedRoom(room)}
								className={`flex w-full cursor-pointer items-center gap-4 rounded-lg px-3 py-4 text-left transition-colors hover:bg-muted ${selectedRoom?.id === room.id ? "bg-muted" : ""}`}
							>
								<span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold">
									{room.initials}
								</span>
								<span className="min-w-0 flex-1">
									<span className="flex items-center justify-between gap-2">
										<span className="truncate text-base font-semibold">{room.name}</span>
										<span className="shrink-0 text-xs text-muted-foreground">{room.time}</span>
									</span>
									<span className="mt-1 block truncate text-sm text-muted-foreground">{room.preview}</span>
								</span>
							</button>
						))}
						{filteredRooms.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No chats found.</p>}
					</div>
				</aside>

				<section className="hidden min-w-0 flex-1 flex-col md:flex">
					{selectedRoom ? (
						<>
							<div className="flex items-center gap-3 border-b px-8 py-5">
								<span className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">{selectedRoom.initials}</span>
								<div>
									<h1 className="font-semibold">{selectedRoom.name}</h1>
									<p className="text-xs text-muted-foreground">Active conversation</p>
								</div>
							</div>
							<div className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto bg-muted/30 p-8">
								{isLoadingMessages && <p className="text-sm text-muted-foreground">Loading messages...</p>}
								{!isLoadingMessages && visibleMessages.length === 0 && <p className="text-sm text-muted-foreground">Start a secure conversation with {selectedRoom.name}.</p>}
								{visibleMessages.map((chatMessage, index) => {
									const previousMessage = visibleMessages[index - 1];
									const isNewDate = !previousMessage || new Date(previousMessage.created_at).toDateString() !== new Date(chatMessage.created_at).toDateString();

									return (
										<div key={chatMessage.id} className="space-y-3">
											{isNewDate && <div className="py-3 text-center text-xs font-medium text-muted-foreground">{formatMessageDate(chatMessage.created_at)}</div>}
											<div className={`flex ${String(chatMessage.sender_id) === String(userId) ? "justify-end" : "justify-start"}`}>
												<div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm shadow-sm ${String(chatMessage.sender_id) === String(userId) ? "bg-foreground text-background" : "bg-card"}`}>
													{"text" in chatMessage ? chatMessage.text : "Encrypted message"}
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
							<Card className="mb-7 flex size-24 items-center justify-center rounded-3xl bg-muted shadow-none">
								<span className="text-4xl text-muted-foreground" aria-hidden="true">≡</span>
							</Card>
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
											<span>
												<span className="block font-medium">{user.name}</span>
												<span className="block opacity-70">{user.email}</span>
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
		</main>
	);
}
