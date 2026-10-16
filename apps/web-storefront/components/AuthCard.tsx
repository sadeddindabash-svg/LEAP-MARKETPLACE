import type { ReactNode } from "react";

/** The frame of the sign-in pages: a centred card with a title and a line under it. */
export default function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-8">
      <div className="rounded-[14px] border border-line border-t-[6px] border-t-signal bg-white p-7">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{title}</h1>
        {subtitle && <p className="mb-5 mt-2 text-muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
