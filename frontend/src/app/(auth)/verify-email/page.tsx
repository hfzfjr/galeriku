import type { Metadata } from "next";
import { VerifyEmailForm } from "./verify-email-form";

export const metadata: Metadata = {
  title: "Verifikasi email",
};

export default function VerifyEmailPage() {
  return <VerifyEmailForm />;
}
