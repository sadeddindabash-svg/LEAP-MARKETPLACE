import { permanentRedirect } from "next/navigation";
import { localizePath } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

// The old website spelled this address "privecy-policy"; any link or bookmark to it goes to the right page.
export default async function Page() {
  permanentRedirect(localizePath(await getLang(), "/privacy-policy"));
}
