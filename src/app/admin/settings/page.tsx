import { PageHeader } from "@/components/layout/page-header";
import { requireAdminPage } from "@/lib/authz";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdminPage();
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Restaurant settings" description="How your restaurant appears to your team. Changing these details never affects training records." />
      <SettingsForm initial={{
        name: s.name, description: s.description ?? "", address: s.address ?? "", contactEmail: s.contactEmail ?? "",
        contactPhone: s.contactPhone ?? "", preferredLanguage: s.preferredLanguage, logoUrl: s.logoUrl,
      }} />
    </>
  );
}
