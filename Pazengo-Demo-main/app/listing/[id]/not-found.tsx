import Link from "next/link";

export default function ListingNotFound(): JSX.Element {
  return (
    <div className="min-h-screen">
      <header className="bg-asphalt text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/" aria-label="Pazengo home"><img src="/logo/logo-dark.png" alt="Pazengo" className="h-8 w-auto" /></Link>
          <Link href="/login" className="rounded bg-white px-3 py-1.5 text-sm font-semibold text-asphalt hover:bg-gray-100">
            Sign in / Register
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-line bg-white p-6 text-center">
          <h1 className="text-xl font-bold">This listing is no longer available</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            It may have been sold, unlisted, or the link is incorrect. Browse similar cars or back to all listings.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/" className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
              Back to listings
            </Link>
            <Link href="/#listings" className="rounded border border-line px-4 py-2 text-sm font-semibold hover:bg-lot">
              View featured cars
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
