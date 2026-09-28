"use client";

import type { SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MessageComposerProps = {
	value: string;
	onValueChange: (value: string) => void;
	onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
	error: string;
};

export function MessageComposer({ value, onValueChange, onSubmit, error }: MessageComposerProps) {
	return (
		<form onSubmit={onSubmit} className="flex gap-3 border-t p-5">
			{error && <p className="absolute -mt-12 text-sm text-red-600 dark:text-red-400">{error}</p>}
			<Input
				value={value}
				onChange={(event) => onValueChange(event.target.value)}
				placeholder="Type your message..."
				aria-label="Message"
			/>
			<Button type="submit">Send</Button>
		</form>
	);
}
