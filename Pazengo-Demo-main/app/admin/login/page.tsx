import Link from "next/link";
import LoginForm from "@/components/login-form";

export default function AdminLoginPage(): JSX.Element {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link href="/" aria-label="Pazengo home" className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/logo-light.png" alt="Pazengo" className="h-9 w-auto" />
        <span className="font-normal text-gray-500">admin</span>
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Sign in</h1>
      <p className="mb-4 mt-1 text-sm text-gray-600">Single admin account from your server settings. No self-registration.</p>
      <div className="rounded-lg border border-line bg-white p-4">
        <LoginForm />
      </div>
    </div>
  );
}
