"use client";

import type { SubmitEvent } from "react";
import { SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReplyTarget } from "@/types/chat";

type MessageComposerProps = {
	value: string;
	onValueChange: (value: string) => void;
	onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
	isSending: boolean;
	error: string;
	replyTarget: ReplyTarget | null;
	onCancelReply: () => void;
};

export function MessageComposer({ value, onValueChange, onSubmit, isSending, error, replyTarget, onCancelReply }: MessageComposerProps) {
	return (
		<form onSubmit={onSubmit} className="border-t p-4 md:p-5">
			{error && <p className="absolute -mt-12 text-sm text-red-600 dark:text-red-400">{error}</p>}
			{replyTarget && (
				<div className="mb-3 flex min-w-0 items-center justify-between gap-3 border-l-2 border-foreground/50 pl-3">
					<div className="min-w-0 text-xs">
						<p className="font-semibold">Replying to {replyTarget.senderName}</p>
						<p className="line-clamp-2 whitespace-pre-wrap wrap-anywhere text-muted-foreground">{replyTarget.plaintext}</p>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8 shrink-0"
						aria-label="Cancel reply"
						title="Cancel reply"
						disabled={isSending}
						onClick={onCancelReply}
					>
						<X className="size-4" />
					</Button>
				</div>
			)}
			<div className="flex gap-3">
				<Input
					value={value}
					onChange={(event) => onValueChange(event.target.value)}
					placeholder="Type your message..."
					aria-label="Message"
					disabled={isSending}
				/>
				<Button
					className="shrink-0 size-10"
					size="icon"
					type="submit"
					disabled={isSending}
					aria-label={isSending ? "Sending message" : "Send message"}
					title={isSending ? "Sending message" : "Send message"}
				>
					<SendHorizontal className="size-5" aria-hidden="true" />
				</Button>
			</div>
		</form>
	);
}
