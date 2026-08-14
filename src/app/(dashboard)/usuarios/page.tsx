import { requireUser } from "@/features/auth/session";
import { listUsersForAdmin } from "@/features/auth/admin-service";
import { UserManager } from "./user-manager";

export default async function UsersPage() {
  const user = await requireUser("admin");
  const items = await listUsersForAdmin();
  return <UserManager currentUserId={user.userId} items={items.map((item) => ({ id: item.id, name: item.name, email: item.email, role: item.role, status: item.status }))} />;
}
