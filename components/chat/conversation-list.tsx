"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PresenceDot } from "@/components/ui/presence";
import type { Room } from "@/types/chat";
import { Plus } from "lucide-react";

type ConversationListProps = {
	rooms: Room[];
	selectedRoomId?: string;
	isHidden: boolean;
	onSelectRoom: (room: Room) => void;
	onCreateConversation: () => void;
};

function UnreadBadge({ count }: { count: number }) {
	return (
		<span
			className={`flex h-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background ${
				count < 10 ? "w-5" : "min-w-5 px-1.5"
			}`}
		>
			{count}
		</span>
	);
}

export function ConversationList({
	rooms,
	selectedRoomId,
	isHidden,
	onSelectRoom,
	onCreateConversation,
}: ConversationListProps) {
	const [search, setSearch] = useState("");
	const filteredRooms = useMemo(
		() => rooms.filter((room) => room.name.toLowerCase().includes(search.toLowerCase())),
		[rooms, search],
	);

	return (
		<aside className={`min-h-0 w-full shrink-0 flex-col border-r md:flex md:max-w-sm md:w-[34%] ${isHidden ? "hidden" : "flex"}`}>
			<div className="flex items-center gap-2 p-6">
				<Input
					aria-label="Search conversations"
					placeholder="Search conversations"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					className="h-12 rounded-full px-5"
				/>
				<Button type="button" className="h-12 shrink-0 rounded-md px-4" onClick={onCreateConversation}>
					<div className="flex items-center gap-2">
						<Plus className="size-4" />
						<span className="hidden sm:inline">New chat</span>
					</div>
				</Button>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
				{filteredRooms.map((room) => (
					<button
						key={room.id}
						type="button"
						onClick={() => onSelectRoom(room)}
						className={`flex w-full cursor-pointer items-center gap-4 rounded-lg px-3 py-4 text-left transition-colors hover:bg-muted ${selectedRoomId === room.id ? "bg-muted" : ""}`}
					>
						<span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold border">
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
								{room.unreadCount > 0 && <UnreadBadge count={room.unreadCount} />}
							</span>
						</span>
					</button>
				))}
				{filteredRooms.length === 0 && (
					<p className="px-3 py-8 text-center text-sm text-muted-foreground">No chats found.</p>
				)}
			</div>
		</aside>
	);
}
