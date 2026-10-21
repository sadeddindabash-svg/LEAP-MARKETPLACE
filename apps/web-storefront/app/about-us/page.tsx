import LegalPage, { legalMetadata } from "@/components/LegalPage";

// /about-us: written in the admin portal (Settings -> Pages), see components/LegalPage.tsx.
export const generateMetadata = () => legalMetadata("about");
export default function Page() {
  return <LegalPage pageKey="about" />;
}
