"use client";

import { useEffect, type HTMLAttributes, type ReactNode } from "react";

type DialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
};

let openDialogs = 0;

/**
 * Apakah ada dialog yang sedang terbuka.
 *
 * Dialog mengurus Escape-nya sendiri, tapi pintasan Escape milik halaman
 * (misalnya "tutup room chat") juga terpasang di `window` dan ikut menyala.
 * Halaman mengecek fungsi ini supaya satu tekanan Escape tidak menutup dialog
 * sekaligus panel di belakangnya. Dihitung otomatis dari siklus hidup dialog,
 * jadi menambah dialog baru tidak perlu mengubah halaman.
 */
export function isAnyDialogOpen() {
	return openDialogs > 0;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
	useEffect(() => {
		if (!open) return;

		openDialogs += 1;

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key !== "Escape") return;
			onOpenChange(false);
		}

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			openDialogs -= 1;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [open, onOpenChange]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onOpenChange(false);
			}}
		>
			{children}
		</div>
	);
}

export function DialogContent({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
	return <div role="dialog" aria-modal="true" className={`w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg ${className}`} {...props} />;
}

export function DialogHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
	return <div className={`space-y-2 ${className}`} {...props} />;
}

export function DialogTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
	return <h2 className={`text-lg font-semibold ${className}`} {...props} />;
}

export function DialogDescription({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
	return <p className={`text-sm text-muted-foreground ${className}`} {...props} />;
}

export function DialogFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
	return <div className={`mt-6 flex justify-end gap-2 ${className}`} {...props} />;
}
