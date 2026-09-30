import Link from "next/link";
import { UserLoginForm } from "@/components/auth-forms";

function safeNextParam(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.startsWith("/") && !s.startsWith("//") ? s : undefined;
}

export default function LoginPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): JSX.Element {
  const next = safeNextParam(searchParams.next);
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <Link href="/" aria-label="Pazengo home"><img src="/logo/logo-light.png" alt="Pazengo" className="h-9 w-auto" /></Link>
      <h1 className="mt-2 text-2xl font-bold">Sign in</h1>
      <p className="mb-4 mt-1 text-sm text-gray-600">Welcome back. New here? <Link href={registerHref} className="font-semibold text-trader hover:underline">Create an account</Link>.</p>
      {next ? <p className="mb-3 rounded border border-line bg-lot px-3 py-2 text-xs text-gray-600">Sign in to continue — you&apos;ll pick up right where you left off.</p> : null}
      <div className="rounded-lg border border-line bg-white p-4">
        <UserLoginForm next={next} />
      </div>
      <p className="mt-4 text-center text-xs text-gray-500">
        Staff? <Link href="/admin/login" className="font-semibold text-trader hover:underline">Sign in to admin</Link>
      </p>
    </div>
  );
}
