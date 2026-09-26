import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
};

export function Button({ className = "", variant = "default", ...props }: ButtonProps) {
  const variantClass = {
    default: "bg-foreground text-background hover:opacity-90",
    outline: "border bg-transparent hover:bg-muted",
    ghost: "bg-transparent hover:bg-muted",
  }[variant];

  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${variantClass} ${className}`}
      {...props}
    />
  );
}