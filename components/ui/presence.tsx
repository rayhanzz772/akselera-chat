"use client";

import { usePresence, type Presence } from "@/lib/presence/store";

const relativeTime = new Intl.RelativeTimeFormat("id", { numeric: "auto" });

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
	{ amount: 60, unit: "second" },
	{ amount: 60, unit: "minute" },
	{ amount: 24, unit: "hour" },
	{ amount: 7, unit: "day" },
	{ amount: 4.34524, unit: "week" },
	{ amount: 12, unit: "month" },
	{ amount: Number.POSITIVE_INFINITY, unit: "year" },
];

function formatRelative(value: string) {
	let duration = (new Date(value).getTime() - Date.now()) / 1000;
	if (Number.isNaN(duration)) return null;

	for (const division of DIVISIONS) {
		if (Math.abs(duration) < division.amount) {
			return relativeTime.format(Math.round(duration), division.unit);
		}
		duration /= division.amount;
	}

	return null;
}

export function presenceLabel(presence: Presence): string | null {
	if (presence.is_online) return "Online";
	if (!presence.last_seen_at) return null;

	const relative = formatRelative(presence.last_seen_at);
	return relative ? `Last seen ${relative}` : null;
}

export function PresenceDot({ userId, className = "" }: { userId: string | null | undefined; className?: string }) {
	const presence = usePresence(userId);
	if (!presence.is_online) return null;

	return (
		<span
			role="img"
			aria-label="Online"
			title="Online"
			className={`absolute right-0 bottom-0 size-3 rounded-full border-2 border-card bg-emerald-500 ${className}`}
		/>
	);
}

export function PresenceLabel({
	userId,
	fallback,
	className = "text-xs text-muted-foreground",
}: {
	userId: string | null | undefined;
	fallback?: string;
	className?: string;
}) {
	const presence = usePresence(userId);
	const label = presenceLabel(presence) ?? fallback;
	if (!label) return null;

	return <p className={className}>{label}</p>;
}
