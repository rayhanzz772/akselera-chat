"use client";

import Image from "next/image";
import { ChevronDown, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { initialsFrom } from "@/lib/format/name";

interface HeaderProps {
  userName?: string;
  onLogout?: () => void;
  className?: string;
}

export function Header({ userName, onLogout, className = "" }: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();

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
        {userName ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              aria-label={`${userName} menu`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="hidden sm:inline">{userName}</span>
              <span className="flex size-9 items-center justify-center rounded-full border border-border/50 bg-muted text-xs font-semibold">
                {initialsFrom(userName)}
              </span>
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                {resolvedTheme === "dark"
                  ? <Sun className="size-4" aria-hidden="true" />
                  : <Moon className="size-4" aria-hidden="true" />}
                Change Theme
              </DropdownMenuItem>
              {onLogout && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={onLogout}>
                    <LogOut className="size-4" aria-hidden="true" />
                    Logout
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <ModeToggle />
        )}
      </div>
    </header>
  );
}