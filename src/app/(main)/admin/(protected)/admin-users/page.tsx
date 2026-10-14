import { verifyAdminSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { AdminUserForm } from "@/components/admin/AdminUserForm";
import { ChangePasswordButton } from "@/components/admin/ChangePasswordButton";
import { deleteAdminUser } from "./actions";


export default async function AdminUsersPage() {
  const session = await verifyAdminSession();

  const adminUsers = await prisma.adminUser.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <AdminUserForm />

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Created</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {adminUsers.map((user) => (
              <tr
                key={user.id}
                className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/50"
              >
                <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">{user.name}</td>
                <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{user.email}</td>
                <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400 capitalize">{user.role}</td>
                <td className="px-5 py-3 text-zinc-500 dark:text-zinc-400">
                  {user.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <ChangePasswordButton adminUserId={user.id} />
                    {user.id !== session.adminUserId && (
                      <form action={deleteAdminUser.bind(null, user.id)}>
                        <button
                          type="submit"
                          className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                        >
                          Delete
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {adminUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-zinc-400 dark:text-zinc-500">
                  No admin users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
