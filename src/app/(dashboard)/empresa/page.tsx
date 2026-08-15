import { requireUser } from "@/features/auth/session";
import { getCompanySettings } from "@/features/company/service";
import { CompanyManager } from "./company-manager";

export default async function CompanySettingsPage() {
  await requireUser("admin");
  const company = await getCompanySettings();
  return <CompanyManager company={company} />;
}
