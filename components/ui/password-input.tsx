"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export function PasswordInput({
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={isVisible ? "text" : "password"} className={`pr-10 ${className}`} />
      <button
        type="button"
        onClick={() => setIsVisible((current) => !current)}
        aria-label="Show password"
        aria-pressed={isVisible}
        className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
