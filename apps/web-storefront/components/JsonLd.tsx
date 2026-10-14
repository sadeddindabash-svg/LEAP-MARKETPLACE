import { jsonLdString } from "@/lib/seo";

/** Structured data for search engines. A Server Component: the data is in the page's HTML, where a crawler reads it. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
