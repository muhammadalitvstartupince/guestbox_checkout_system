import { verifyAdminSession } from "@/lib/auth/dal";
import { getEmailSettings } from "@/lib/email/settings";
import { EmailSettingsForm } from "@/components/admin/EmailSettingsForm";
import { TestEmailPanel } from "@/components/admin/TestEmailPanel";

export default async function AdminEmailSettingsPage() {
  const session = await verifyAdminSession();
  const settings = await getEmailSettings();

  return (
    <div className="max-w-3xl space-y-6">
      <TestEmailPanel defaultTo={session.email as string} />
      <EmailSettingsForm
        defaults={{
          hasSendgridApiKey: !!settings.sendgridApiKey,
          emailFrom: settings.emailFrom,
          internalNotifyEmails: settings.internalNotifyEmails.join(", "),
          customerConfirmationEnabled: settings.customerConfirmationEnabled,
          customerConfirmationSubject: settings.customerConfirmationSubject,
          customerConfirmationHtml: settings.customerConfirmationHtml,
          internalNotifySubject: settings.internalNotifySubject,
          internalNotifyHtml: settings.internalNotifyHtml,
        }}
      />
    </div>
  );
}
