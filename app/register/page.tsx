"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { registerUser } from "@/lib/api/auth";
import { createUserKeyMaterial } from "@/lib/crypto/user-keys";
import { saveEncryptedKeyMaterial } from "@/lib/crypto/session";
import { Header } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toast";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      toast.add({ title: "Registration failed", description: "Password must be at least 8 characters.", type: "error" });
      return;
    }

    setIsSubmitting(true);

    try {
      const keyMaterial = await createUserKeyMaterial(password);
      await registerUser({
        name: name.trim(),
        email: email.trim(),
        password,
        ...keyMaterial,
      });
      saveEncryptedKeyMaterial(
        email.trim(),
        keyMaterial.encrypted_private_key,
        keyMaterial.key_derivation_salt,
      );

      setPassword("");
      toast.add({ title: "Account created", description: "Your account is ready. Please log in.", type: "success" });
      router.replace("/login");
    } catch (submissionError) {
      const description = submissionError instanceof Error
        ? submissionError.message
        : "Registration failed. Please try again.";
      setError(
        description,
      );
      toast.add({ title: "Registration failed", description, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
      <Header />

      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 pb-16">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 sm:p-10">
            <div className="mb-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Akselera Chat
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">Create account</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Your private key is encrypted locally before it leaves this device.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2 text-sm font-medium">
                <span>Name</span>
                <Input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  type="text"
                  autoComplete="name"
                />
              </label>
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
                  autoComplete="new-password"
                />
              </label>

              {error && <p className="rounded-md border border-foreground/20 bg-muted px-3 py-2 text-sm">{error}</p>}
              {success && <p className="rounded-md border border-foreground/20 bg-muted px-3 py-2 text-sm">{success}</p>}

              <Button disabled={isSubmitting} className="w-full" type="submit">
                {isSubmitting ? "Generating secure keys..." : "Create account"}
              </Button>
            </form>

                        <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <a href="/login" className="font-medium text-foreground underline underline-offset-4">
                Login
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}