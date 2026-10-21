import LegalPage, { legalMetadata } from "@/components/LegalPage";

// /cancellation-replacement-policy: written in the admin portal (Settings -> Pages), see components/LegalPage.tsx.
export const generateMetadata = () => legalMetadata("cancellation");
export default function Page() {
  return <LegalPage pageKey="cancellation" />;
}
