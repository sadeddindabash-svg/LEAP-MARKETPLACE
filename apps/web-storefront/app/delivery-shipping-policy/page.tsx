import LegalPage, { legalMetadata } from "@/components/LegalPage";

// /delivery-shipping-policy: written in the admin portal (Settings -> Pages), see components/LegalPage.tsx.
export const generateMetadata = () => legalMetadata("delivery");
export default function Page() {
  return <LegalPage pageKey="delivery" />;
}
