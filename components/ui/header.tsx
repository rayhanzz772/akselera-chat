"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { initialsFrom } from "@/lib/format/name";

interface HeaderProps {
  isDark: boolean;
  onThemeChange: () => void;
  userName?: string;
  onLogout?: () => void;
  className?: string;
}

export function Header({ isDark, onThemeChange, userName, onLogout, className = "" }: HeaderProps) {
  return (
    <header className={`mx-auto flex w-full max-w-7xl shrink-0 items-center justify-between px-6 py-6 ${className}`}>
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
            {initialsFrom(userName)}
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