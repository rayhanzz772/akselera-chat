"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Presence = {
	user_id: string;
	is_online: boolean;
	last_seen_at: string | null;
};

/** Bentuk minimum yang dibutuhkan untuk menyemai status dari respons REST. */
export type PresenceSeed = {
	id: string;
	is_online?: boolean;
	last_seen_at?: string | null;
};

/**
 * Objek fallback ini WAJIB berupa satu konstanta modul.
 * `useSyncExternalStore` membandingkan snapshot dengan `Object.is`, jadi objek
 * literal yang dibuat ulang tiap pemanggilan akan memicu render tanpa henti.
 */
const UNKNOWN_PRESENCE: Presence = {
	user_id: "",
	is_online: false,
	last_seen_at: null,
};

const presenceByUserId = new Map<string, Presence>();
const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) {
		listener();
	}
}

/** Gabungkan status ke dalam store. Hanya entri yang benar-benar berubah yang memicu render. */
export function setPresence(entries: Presence[]) {
	let changed = false;

	for (const entry of entries) {
		if (!entry?.user_id) continue;

		const userId = String(entry.user_id);
		const current = presenceByUserId.get(userId);
		if (
			current &&
			current.is_online === entry.is_online &&
			current.last_seen_at === entry.last_seen_at
		) {
			continue;
		}

		presenceByUserId.set(userId, {
			user_id: userId,
			is_online: Boolean(entry.is_online),
			last_seen_at: entry.last_seen_at ?? null,
		});
		changed = true;
	}

	if (changed) emit();
}

/**
 * Timpa seluruh isi store dengan payload `presence:sync`.
 * Dipakai karena payload itu otoritatif: status yang tidak disebut di dalamnya
 * bisa jadi sudah basi, jadi tidak boleh sekadar digabung. Ini juga yang membuat
 * auto-reconnect Socket.IO tetap benar.
 */
export function replacePresence(entries: Presence[]) {
	presenceByUserId.clear();

	for (const entry of entries) {
		if (!entry?.user_id) continue;

		const userId = String(entry.user_id);
		presenceByUserId.set(userId, {
			user_id: userId,
			is_online: Boolean(entry.is_online),
			last_seen_at: entry.last_seen_at ?? null,
		});
	}

	emit();
}

/**
 * Semai status dari respons REST (`conversations` / `users`).
 *
 * Entri tanpa `is_online` maupun `last_seen_at` sengaja dilewati: kalau backend
 * belum mengirim kedua field itu, penyemaian jadi no-op, bukan menandai semua
 * orang offline.
 */
export function seedPresence(entries: PresenceSeed[]) {
	setPresence(
		entries
			.filter((entry) => entry?.id && (entry.is_online !== undefined || entry.last_seen_at !== undefined))
			.map((entry) => ({
				user_id: String(entry.id),
				is_online: Boolean(entry.is_online),
				last_seen_at: entry.last_seen_at ?? null,
			})),
	);
}

export function getPresence(userId: string | null | undefined): Presence {
	if (!userId) return UNKNOWN_PRESENCE;
	return presenceByUserId.get(String(userId)) ?? UNKNOWN_PRESENCE;
}

export function subscribePresence(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function usePresence(userId: string | null | undefined): Presence {
	const subscribe = useCallback((listener: () => void) => subscribePresence(listener), []);
	const getSnapshot = useCallback(() => getPresence(userId), [userId]);

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
