import Link from "next/link";
import { RegisterForm } from "@/components/auth-forms";

function safeNextParam(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.startsWith("/") && !s.startsWith("//") ? s : undefined;
}

export default function RegisterPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): JSX.Element {
  const next = safeNextParam(searchParams.next);
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <Link href="/" aria-label="Pazengo home"><img src="/logo/logo-light.png" alt="Pazengo" className="h-9 w-auto" /></Link>
      <h1 className="mt-2 text-2xl font-bold">Create an account</h1>
      <p className="mb-4 mt-1 text-sm text-gray-600">Create your free account to get started. Already registered? <Link href={loginHref} className="font-semibold text-trader hover:underline">Sign in</Link>.</p>
      <div className="rounded-lg border border-line bg-white p-4">
        <RegisterForm next={next} />
      </div>
      <p className="mt-4 text-center text-xs text-gray-500">
        Staff? <Link href="/admin/login" className="font-semibold text-trader hover:underline">Sign in to admin</Link>
      </p>
    </div>
  );
}
