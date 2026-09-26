"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export function ModeToggle({ isDark, onToggle }: ModeToggleProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-pressed={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      onClick={onToggle}
      className="relative overflow-hidden"
    >
      <Sun className={`size-[1.2rem] transition-all ${isDark ? "scale-0 rotate-90" : "scale-100 rotate-0"}`} />
      <Moon className={`absolute size-[1.2rem] transition-all ${isDark ? "scale-100 rotate-0" : "scale-0 -rotate-90"}`} />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}