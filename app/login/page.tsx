"use client";

import { FormEvent, useState } from "react";
import { loginUser } from "@/lib/api/auth";
import { createUserKeyMaterial } from "@/lib/crypto/user-keys";
import { Header } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDark, setIsDark] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const keyMaterial = await createUserKeyMaterial(password);
      await loginUser({
        email: email.trim(),
        password,
        ...keyMaterial,
      });

      setPassword("");
      setSuccess("Login successful.");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Login failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={isDark ? "dark min-h-screen bg-background text-foreground" : "min-h-screen bg-background text-foreground"}>
      <Header onThemeChange={() => setIsDark((current) => !current)} isDark={isDark} />

      <div className="mx-auto flex min-h-[calc(100vh-104px)] w-full max-w-6xl items-center justify-center px-6 pb-16">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 sm:p-10">
            <div className="mb-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Akselera Chat
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">Login</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Your private key is encrypted locally before it leaves this device.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2 text-sm font-medium">
                <span>Email</span>
                <Input
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Password</span>
                <Input
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                />
              </label>

              {error && <p className="rounded-md border border-foreground/20 bg-muted px-3 py-2 text-sm">{error}</p>}
              {success && <p className="rounded-md border border-foreground/20 bg-muted px-3 py-2 text-sm">{success}</p>}

              <Button disabled={isSubmitting} className="w-full" type="submit">
                {isSubmitting ? "Please Wait..." : "Login"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <a href="/register" className="font-medium text-foreground underline underline-offset-4">
                Register
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
