import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLoadingSkeleton } from "@/components/auth/guest-only";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

export default function LoginPage() {
  // useSearchParams (?info=reset) wajib di dalam Suspense.
  return (
    <Suspense fallback={<AuthLoadingSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
