import LegalPage, { legalMetadata } from "@/components/LegalPage";

// /terms-conditions: written in the admin portal (Settings -> Pages), see components/LegalPage.tsx.
export const generateMetadata = () => legalMetadata("terms");
export default function Page() {
  return <LegalPage pageKey="terms" />;
}
