import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ConfirmDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	confirmLabel: string;
	onConfirm: () => void;
	cancelLabel?: string;
	isPending?: boolean;
};

/** Dialog konfirmasi generik — dipakai untuk hapus percakapan dan logout. */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	onConfirm,
	cancelLabel = "Cancel",
	isPending = false,
}: ConfirmDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						{cancelLabel}
					</Button>
					<Button type="button" disabled={isPending} onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
