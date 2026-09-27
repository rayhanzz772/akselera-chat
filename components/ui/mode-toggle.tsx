"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const subscribe = () => () => {};

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const isDark = resolvedTheme === "dark";
  const announcedIsDark = isClient && isDark;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-pressed={announcedIsDark}
      aria-label={`Switch to ${announcedIsDark ? "light" : "dark"} mode`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative overflow-hidden"
    >
      <Sun className="size-[1.2rem] transition-all dark:scale-0 dark:rotate-90" />
      <Moon className="absolute size-[1.2rem] transition-all scale-0 -rotate-90 dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
