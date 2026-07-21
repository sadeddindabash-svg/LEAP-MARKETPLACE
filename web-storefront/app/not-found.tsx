import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-24 text-center">
      <h1 className="font-display font-bold text-4xl">Part not found</h1>
      <p className="mt-3 text-muted">
        This listing may have been removed, or the link is incorrect.
      </p>
      <Link
        href="/search"
        className="mt-6 inline-flex items-center rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors"
      >
        Browse all parts
      </Link>
    </div>
  );
}
