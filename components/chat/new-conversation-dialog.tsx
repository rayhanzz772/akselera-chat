"use client";

import { useEffect, useMemo, useState, type SubmitEvent } from "react";
import { createConversation, getConversations } from "@/lib/api/conversations";
import { getUsers } from "@/lib/api/users";
import { mapConversation, uniqueById } from "@/lib/chat/rooms";
import { initialsFrom } from "@/lib/format/name";
import { seedPresence } from "@/lib/presence/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PresenceDot } from "@/components/ui/presence";
import type { Room, UserSummary } from "@/types/chat";

type NewConversationDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: (result: { rooms: Room[]; room: Room }) => void;
	onRequestPresence: (userIds: string[]) => void;
};

type NewConversationFormProps = Omit<NewConversationDialogProps, "open">;

function NewConversationForm({ onOpenChange, onCreated, onRequestPresence }: NewConversationFormProps) {
	const [userSearch, setUserSearch] = useState("");
	const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
	const [users, setUsers] = useState<UserSummary[]>([]);
	const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
	const [isLoadingUsers, setIsLoadingUsers] = useState(true);
	const [error, setError] = useState("");
	const [isCreating, setIsCreating] = useState(false);

	useEffect(() => {
		const timeout = window.setTimeout(() => setDebouncedUserSearch(userSearch), 300);

		return () => window.clearTimeout(timeout);
	}, [userSearch]);

	useEffect(() => {
		let isCurrent = true;

		void (async () => {
			try {
				const fetchedUsers = (await getUsers()).data;
				if (!isCurrent) return;

				setUsers(fetchedUsers);
				seedPresence(fetchedUsers);
				onRequestPresence(fetchedUsers.map((user) => String(user.id)));
			} catch (usersError) {
				if (isCurrent) {
					setError(usersError instanceof Error ? usersError.message : "Users could not be loaded.");
				}
			} finally {
				if (isCurrent) setIsLoadingUsers(false);
			}
		})();

		return () => {
			isCurrent = false;
		};
	}, [onRequestPresence]);

	const filteredUsers = useMemo(() => {
		const query = debouncedUserSearch.trim().toLowerCase();
		if (!query) return [];
		return users.filter((user) => user.email.toLowerCase().includes(query) || user.name.toLowerCase().includes(query));
	}, [debouncedUserSearch, users]);

	async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedUser) {
			setError("Select a user first.");
			return;
		}

		setError("");
		setIsCreating(true);

		try {
			await createConversation(selectedUser.email);
			const refreshedConversations = await getConversations();
			const rooms = uniqueById(refreshedConversations.data.map(mapConversation));
			const room = rooms.find((candidate) => candidate.opponentId === selectedUser.id);

			if (!room) {
				throw new Error("Conversation created, but it was not returned by the conversations list.");
			}

			onCreated({ rooms, room });
		} catch (creationError) {
			setError(
				creationError instanceof Error ? creationError.message : "Conversation could not be created.",
			);
		} finally {
			setIsCreating(false);
		}
	}

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Start a new conversation</DialogTitle>
				<DialogDescription>Enter the member Email of the person you want to message.</DialogDescription>
			</DialogHeader>

			<form className="mt-6 space-y-4" onSubmit={handleSubmit}>
				<div className="space-y-2">
					<Input
						id="user-email"
						value={userSearch}
						onChange={(event) => {
							setUserSearch(event.target.value);
							setSelectedUser(null);
						}}
						placeholder="johndoe@gmail.com"
						autoFocus
					/>
				</div>

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
										<span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold">
											{initialsFrom(user.name)}
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
				{!isLoadingUsers && userSearch && filteredUsers.length === 0 && (
					<p className="text-sm text-muted-foreground">No users found.</p>
				)}

				{error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button type="submit" disabled={isCreating}>
						{isCreating ? "Creating..." : "Create conversation"}
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}

export function NewConversationDialog({ open, onOpenChange, onCreated, onRequestPresence }: NewConversationDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<NewConversationForm
				onOpenChange={onOpenChange}
				onCreated={onCreated}
				onRequestPresence={onRequestPresence}
			/>
		</Dialog>
	);
}
