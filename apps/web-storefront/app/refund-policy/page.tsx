import LegalPage, { legalMetadata } from "@/components/LegalPage";

// /refund-policy: written in the admin portal (Settings -> Pages), see components/LegalPage.tsx.
export const generateMetadata = () => legalMetadata("refund");
export default function Page() {
  return <LegalPage pageKey="refund" />;
}
