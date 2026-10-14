import { verifySession } from "@/lib/auth/dal";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar role={session.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminTopbar name={session.name as string} email={session.email as string} />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
