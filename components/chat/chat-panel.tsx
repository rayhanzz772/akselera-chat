"use client";

import type { Ref, SubmitEvent } from "react";
import type { LoadedMessage } from "@/lib/api/messages";
import { ArrowLeft, Contact, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PresenceDot, PresenceLabel } from "@/components/ui/presence";
import { MessageComposer } from "@/components/chat/message-composer";
import { MessageList, type MessageListHandle } from "@/components/chat/message-list";
import type { Room } from "@/types/chat";

type ChatPanelProps = {
	room: Room | null;
	userId: string | number | null;
	messages: LoadedMessage[];
	isLoadingMessages: boolean;
	message: string;
	onMessageChange: (value: string) => void;
	onSend: (event: SubmitEvent<HTMLFormElement>) => void;
	isSending: boolean;
	messageError: string;
	onBack: () => void;
	onDelete: () => void;
	messageListRef?: Ref<MessageListHandle>;
};

function EmptyState() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
			<Contact className="mb-4 h-24 w-24" />
			<h1 className="text-xl font-semibold">Select Chat or Start New Chat</h1>
			<p className="mt-3 max-w-md text-base text-muted-foreground">
				Select a chat from the list or start a new conversation to begin messaging. You can also search for contacts to find someone to chat with.
			</p>
		</div>
	);
}

export function ChatPanel({
	room,
	userId,
	messages,
	isLoadingMessages,
	message,
	onMessageChange,
	onSend,
	isSending,
	messageError,
	onBack,
	onDelete,
	messageListRef,
}: ChatPanelProps) {
	return (
		<section className={`min-h-0 min-w-0 flex-1 flex-col md:flex ${room ? "flex" : "hidden"}`}>
			{room ? (
				<>
					<div className="flex items-center justify-between gap-3 border-b px-4 py-5 md:px-8">
						<div className="flex items-center gap-3">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="md:hidden"
								onClick={onBack}
								aria-label="Back to conversations"
								title="Back to conversations"
							>
								<ArrowLeft className="size-4" />
							</Button>
							<span className="relative flex size-10 items-center border border-border/50 justify-center rounded-full bg-muted text-sm font-semibold">
								{room.initials}
								<PresenceDot userId={room.opponentId} />
							</span>
							<div>
								<h1 className="font-semibold">{room.name}</h1>
								<PresenceLabel userId={room.opponentId} fallback="Active conversation" />
							</div>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={onDelete}
							aria-label="Delete conversation"
							title="Delete conversation"
						>
							<Trash2 className="size-4" />
						</Button>
					</div>

					<MessageList
						ref={messageListRef}
						roomId={room.id}
						roomName={room.name}
						messages={messages}
						userId={userId}
						isLoading={isLoadingMessages}
					/>
					<MessageComposer
						value={message}
						onValueChange={onMessageChange}
						onSubmit={onSend}
						isSending={isSending}
						error={messageError}
					/>
				</>
			) : (
				<EmptyState />
			)}
		</section>
	);
}
