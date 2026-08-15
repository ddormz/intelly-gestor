import { requireUser } from "@/features/auth/session";
import { listUsersForAdmin } from "@/features/auth/admin-service";
import { parsePageQuery } from "@/lib/list-query";
import { UserManager } from "./user-manager";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("admin");
  const query = parsePageQuery(await searchParams);
  const result = await listUsersForAdmin(query);
  return <UserManager currentUserId={user.userId} query={query} page={result.page} pageSize={result.pageSize} total={result.total} items={result.items.map((item) => ({ id: item.id, name: item.name, email: item.email, role: item.role, status: item.status }))} />;
}
