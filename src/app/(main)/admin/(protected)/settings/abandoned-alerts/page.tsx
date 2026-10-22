import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { AbandonedAlertSettingsForm } from "@/components/admin/AbandonedAlertSettingsForm";
import { TestSlackPanel } from "@/components/admin/TestSlackPanel";

export default async function AbandonedAlertsPage() {
  await verifyAdminSession();
  const settings = await prisma.abandonedCheckoutSettings.findFirst();

  return (
    <div className="max-w-3xl space-y-6">
      <TestSlackPanel />
      <AbandonedAlertSettingsForm
        defaults={{
          enabled: settings?.enabled ?? false,
          slackWebhookUrl: settings?.slackWebhookUrl ?? "",
          timeoutMinutes: settings?.timeoutMinutes ?? 30,
        }}
      />
    </div>
  );
}
