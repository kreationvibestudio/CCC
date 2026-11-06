import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { getUnitMember } from "@/lib/members/actions";
import { MemberDetailView } from "@/components/members/member-detail-view";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/members");
  if (!hasPermission(user.role, "members.view") && !hasPermission(user.role, "admin.users")) {
    redirect("/dashboard");
  }
  const { id } = await params;
  const result = await getUnitMember(id);
  if (!result.member) notFound();
  return <MemberDetailView member={result.member} />;
}
