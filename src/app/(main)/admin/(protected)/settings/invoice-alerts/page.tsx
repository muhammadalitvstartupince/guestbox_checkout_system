import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { InvoiceSlackSettingsForm } from "@/components/admin/InvoiceSlackSettingsForm";
import { InvoiceSlackTestPanel } from "@/components/admin/InvoiceSlackTestPanel";

export default async function InvoiceAlertsPage() {
  await verifyAdminSession();
  const settings = await prisma.invoiceSlackSettings.findFirst();

  return (
    <div className="max-w-3xl space-y-6">
      <InvoiceSlackTestPanel />
      <InvoiceSlackSettingsForm
        defaults={{
          enabled: settings?.enabled ?? false,
          slackWebhookUrl: settings?.slackWebhookUrl ?? "",
        }}
      />
    </div>
  );
}
