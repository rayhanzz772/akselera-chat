"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  isDark: boolean;
  onThemeChange: () => void;
}

export function Header({ isDark, onThemeChange }: HeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Image
        src={isDark ? "/assets/logo/white.png" : "/assets/logo/dark.png"}
        alt="Akselera Tech"
        width={240}
        height={90}
        className="h-16 w-auto object-contain"
      />
      <Button
        type="button"
        variant="outline"
        aria-pressed={isDark}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        onClick={onThemeChange}
        className="gap-2"
      >
        <span aria-hidden="true" className="text-base">
          {isDark ? "○" : "●"}
        </span>
        {isDark ? "Light" : "Dark"}
      </Button>
    </header>
  );
}