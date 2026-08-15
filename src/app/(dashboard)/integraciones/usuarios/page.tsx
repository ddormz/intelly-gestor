import { redirect } from "next/navigation";

export default async function LegacyUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) params.set(key, first);
  }
  const query = params.toString();
  redirect(query ? `/usuarios?${query}` : "/usuarios");
}
