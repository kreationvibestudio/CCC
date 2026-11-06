import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { listUnitMembers } from "@/lib/members/actions";
import { MembersListView } from "@/components/members/members-list-view";

export default async function MembersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/members");
  if (!hasPermission(user.role, "members.view") && !hasPermission(user.role, "admin.users")) {
    redirect("/dashboard");
  }
  const listed = await listUnitMembers();
  return (
    <MembersListView members={listed.rows} needsMigration={listed.needsMigration} />
  );
}
