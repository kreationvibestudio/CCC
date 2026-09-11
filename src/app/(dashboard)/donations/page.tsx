import { getDonationsOverview } from "@/lib/donations/hq";
import { DonationsView } from "@/components/donations/donations-view";
import { getCurrentUser } from "@/lib/auth/session";
import { canWriteRecords, hasPermission } from "@/types/auth";

export default async function DonationsPage() {
  const user = await getCurrentUser();
  const overview = await getDonationsOverview();
  if ("error" in overview) {
    return (
      <p className="text-sm text-muted-foreground">
        {overview.error || "Donations are limited to campaign administrators."}
      </p>
    );
  }
  return (
    <DonationsView
      overview={overview}
      canWrite={user ? canWriteRecords(user.role) && hasPermission(user.role, "donations.manage") : false}
    />
  );
}
