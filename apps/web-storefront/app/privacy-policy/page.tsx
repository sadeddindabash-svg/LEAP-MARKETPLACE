import LegalPage, { legalMetadata } from "@/components/LegalPage";

// /privacy-policy: written in the admin portal (Settings -> Pages), see components/LegalPage.tsx.
export const generateMetadata = () => legalMetadata("privacy");
export default function Page() {
  return <LegalPage pageKey="privacy" />;
}
