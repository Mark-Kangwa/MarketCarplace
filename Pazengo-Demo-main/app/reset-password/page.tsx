import Link from "next/link";
import { Suspense } from "react";
import ResetPasswordForm from "@/components/reset-password-form";

export default function ResetPasswordPage(): JSX.Element {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link href="/" className="text-xl font-bold tracking-tight" aria-label="Pazengo home">Pazengo</Link>
      <h1 className="mt-2 text-2xl font-bold">Reset password</h1>
      <div className="mb-4 mt-4 rounded-lg border border-line bg-white p-4">
        <Suspense fallback={<p role="status" className="text-sm text-gray-600">Checking your link…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
