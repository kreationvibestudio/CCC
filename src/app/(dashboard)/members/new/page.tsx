import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-shell";
import { NdcBadge } from "@/components/brand/ndc-logo";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { unitMembersTableNeedsMigration } from "@/lib/members/actions";
import { MemberRegistrationForm } from "@/components/members/member-registration-form";

export default async function NewMemberPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/members/new");
  if (!hasPermission(user.role, "members.manage") && !hasPermission(user.role, "admin.users")) {
    redirect("/members");
  }
  const needsMigration = await unitMembersTableNeedsMigration();
  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4 sm:space-y-6">
      <PageHeader
        title="Register member"
        description="Register an NDC unit member with LGA, ward, and polling unit"
      >
        <NdcBadge />
      </PageHeader>
      <MemberRegistrationForm needsMigration={needsMigration} />
    </div>
  );
}
