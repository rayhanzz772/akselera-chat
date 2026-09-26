import type { HTMLAttributes, ReactNode } from "react";

type DialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
};

export function Dialog({ open, onOpenChange, children }: DialogProps) {
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