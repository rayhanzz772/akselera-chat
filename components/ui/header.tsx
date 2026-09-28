"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { initialsFrom } from "@/lib/format/name";

interface HeaderProps {
  userName?: string;
  onLogout?: () => void;
  className?: string;
}

export function Header({ userName, onLogout, className = "" }: HeaderProps) {
  return (
    <header className={`mx-auto flex w-full shrink-0 items-center justify-between px-6 py-2 ${className}`}>
      <Image
        src="/assets/logo/dark.png"
        alt="Akselera Tech"
        width={240}
        height={90}
        className="h-18 w-auto object-contain dark:hidden"
      />
      <Image
        src="/assets/logo/white.png"
        alt="Akselera Tech"
        width={240}
        height={90}
        className="hidden h-18 w-auto object-contain dark:block"
      />
      <div className="flex items-center gap-4">
        {userName && <span className="hidden text-sm font-medium sm:inline">{userName}</span>}
        {userName && (
          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {initialsFrom(userName)}
          </span>
        )}
        <ModeToggle />
        {onLogout && (
          <Button type="button" variant="outline" onClick={onLogout}>
            Logout
          </Button>
        )}
      </div>
    </header>
  );
}