/** Hari ini / kemarin / lainnya — dipakai bersama oleh formatter percakapan dan pesan. */
function dayBucket(date: Date) {
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);

	if (date.toDateString() === today.toDateString()) return "today";
	if (date.toDateString() === yesterday.toDateString()) return "yesterday";
	return "other";
}

/**
 * Waktu untuk baris di daftar percakapan: jam kalau hari ini, "Yesterday" kalau
 * kemarin, selain itu tanggal.
 */
export function formatConversationTime(value: string) {
	const date = new Date(value);

	switch (dayBucket(date)) {
		case "today":
			return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		case "yesterday":
			return "Yesterday";
		default: {
			const isCurrentYear = date.getFullYear() === new Date().getFullYear();
			return date.toLocaleDateString(
				undefined,
				isCurrentYear
					? { day: "numeric", month: "short" }
					: { day: "numeric", month: "short", year: "numeric" },
			);
		}
	}
}

/** Pemisah tanggal di dalam daftar pesan. */
export function formatMessageDate(value: string) {
	const date = new Date(value);

	switch (dayBucket(date)) {
		case "today":
			return "Today";
		case "yesterday":
			return "Yesterday";
		default:
			return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
	}
}

export function formatMessageTime(value: string) {
	return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
