"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";

interface HeaderProps {
  isDark: boolean;
  onThemeChange: () => void;
  userName?: string;
  onLogout?: () => void;
}

export function Header({ isDark, onThemeChange, userName, onLogout }: HeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Image
        src={isDark ? "/assets/logo/white.png" : "/assets/logo/dark.png"}
        alt="Akselera Tech"
        width={240}
        height={90}
        className="h-16 w-auto object-contain"
      />
      <div className="flex items-center gap-4">
        {userName && <span className="hidden text-sm font-medium sm:inline">{userName}</span>}
        {userName && (
          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {userName
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
        )}
        <ModeToggle isDark={isDark} onToggle={onThemeChange} />
        {onLogout && (
          <Button type="button" variant="outline" onClick={onLogout}>
            Logout
          </Button>
        )}
      </div>
    </header>
  );
}