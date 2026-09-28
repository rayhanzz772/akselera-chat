"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { LoaderCircle } from "lucide-react";
import type { LoadedMessage } from "@/lib/api/messages";
import { ENCRYPTED_PLACEHOLDER } from "@/lib/chat/rooms";
import { formatMessageDate, formatMessageTime } from "@/lib/format/datetime";

export type MessageListHandle = {
	/** Paksa daftar menempel ke bawah — dipakai setelah pengguna mengirim pesan. */
	scrollToBottom: () => void;
};

type MessageListProps = {
	roomId: string | null;
	roomName: string;
	messages: LoadedMessage[];
	userId: string | number | null;
	isLoading: boolean;
	ref?: Ref<MessageListHandle>;
};

/** Jarak dari bawah yang masih dianggap "menempel di bawah", dalam piksel. */
const NEAR_BOTTOM_THRESHOLD = 80;

function isOwnMessage(message: LoadedMessage, userId: string | number | null) {
	return String(message.sender_id) === String(userId);
}

export function MessageList({ roomId, roomName, messages, userId, isLoading, ref }: MessageListProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const isNearBottomRef = useRef(true);

	useImperativeHandle(ref, () => ({
		scrollToBottom() {
			isNearBottomRef.current = true;
			const container = containerRef.current;
			if (container) container.scrollTop = container.scrollHeight;
		},
	}), []);

	// Ganti room berarti mulai dari bawah lagi. Efek ini sengaja diletakkan sebelum
	// efek gulir di bawah supaya flag-nya sudah benar saat pesan baru dipasang.
	useEffect(() => {
		isNearBottomRef.current = true;
	}, [roomId]);

	useEffect(() => {
		const container = containerRef.current;
		// Jangan tarik paksa ke bawah kalau pengguna sedang membaca pesan lama.
		if (!container || !isNearBottomRef.current) return;

		container.scrollTop = container.scrollHeight;
	}, [messages]);

	function handleScroll() {
		const container = containerRef.current;
		if (!container) return;

		isNearBottomRef.current =
			container.scrollHeight - container.scrollTop - container.clientHeight < NEAR_BOTTOM_THRESHOLD;
	}

	return (
		<div
			ref={containerRef}
			onScroll={handleScroll}
			className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain bg-muted/40 p-4 md:p-8"
		>
			{isLoading && (
				<div role="status" className="flex items-center justify-center py-4 text-muted-foreground">
					<LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
					<span className="sr-only">Loading messages...</span>
				</div>
			)}
			{!isLoading && messages.length === 0 && (
				<p className="text-sm text-muted-foreground">Start a secure conversation with {roomName}.</p>
			)}
			{messages.map((message, index) => {
				const previousMessage = messages[index - 1];
				const isNewDate = !previousMessage
					|| new Date(previousMessage.created_at).toDateString() !== new Date(message.created_at).toDateString();
				const isOwn = isOwnMessage(message, userId);

				return (
					<div key={message.id} className="shrink-0 space-y-3">
						{isNewDate && (
							<div className="py-3 text-center text-xs font-medium text-muted-foreground">
								{formatMessageDate(message.created_at)}
							</div>
						)}
						<div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
							<div
								className={`
									max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm
									${isOwn
										? "bg-foreground text-background"
										: "border border-border/50 bg-bubble"
									}
								`}
							>
								<div className="flex items-end gap-2">
									<p className="whitespace-pre-wrap wrap-anywhere leading-relaxed">
										{"text" in message ? message.text : ENCRYPTED_PLACEHOLDER}
									</p>

									<time
										className={`
											shrink-0 text-[10px]
											${isOwn
												? "text-background/60"
												: "text-muted-foreground/70"
											}
										`}
										dateTime={message.created_at}
									>
										{formatMessageTime(message.created_at)}
									</time>
								</div>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
