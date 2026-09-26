import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "icon";
};

export function Button({ className = "", variant = "default", size = "default", ...props }: ButtonProps) {
  const variantClass = {
    default: "bg-foreground text-background hover:opacity-90",
    outline: "border bg-transparent hover:bg-muted",
    ghost: "bg-transparent hover:bg-muted",
  }[variant];

  const sizeClass = size === "icon" ? "size-10 p-0" : "h-10 px-4";

  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${sizeClass} ${variantClass} ${className}`}
      {...props}
    />
  );
}