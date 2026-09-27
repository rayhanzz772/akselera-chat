"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/auth";
import { getEncryptedKeyMaterial, persistSessionKeys } from "@/lib/crypto/session";
import { getPublicKeyFromPrivateKey, unlockPrivateKey } from "@/lib/crypto/user-keys";
import { Header } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDark, setIsDark] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      await loginUser({
        email: email.trim(),
        password,
      });
    const user = await getCurrentUser();
    const storedKeyMaterial = getEncryptedKeyMaterial(email.trim());
    const encryptedPrivateKey = user.encrypted_private_key ?? storedKeyMaterial?.encryptedPrivateKey;
    const keyDerivationSalt = user.key_derivation_salt ?? storedKeyMaterial?.keyDerivationSalt;
	if (encryptedPrivateKey && keyDerivationSalt) {
      const privateKey = await unlockPrivateKey(
        password,
        encryptedPrivateKey,
        keyDerivationSalt,
      );
      await persistSessionKeys(privateKey, await getPublicKeyFromPrivateKey(privateKey));
  } else {
    throw new Error("Encrypted private key is unavailable. Please register this device again or update the /auth/me response.");
    }

      setPassword("");
      router.replace("/chat");
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
    <main className={`flex min-h-dvh flex-col bg-background text-foreground${isDark ? " dark" : ""}`}>
      <Header onThemeChange={() => setIsDark((current) => !current)} isDark={isDark} />

      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 pb-16">
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
                <PasswordInput
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </label>

              {error && <p className="rounded-md border border-foreground/20 bg-muted px-3 py-2 text-sm">{error}</p>}
              {success && <p className="rounded-md border border-foreground/20 bg-muted px-3 py-2 text-sm">{success}</p>}

              <Button disabled={isSubmitting} className="w-full" type="submit">
                {isSubmitting ? "Please Wait..." : "Login"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
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
