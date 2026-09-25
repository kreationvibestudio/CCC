import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessPitchDeck } from "@/lib/pitch-deck/access";
import { PitchDeckPrintView } from "@/components/sales/pitch-deck-print-view";

export default async function PitchDeckPrintPage() {
  const user = await getCurrentUser();
  if (!user || !canAccessPitchDeck(user)) {
    redirect("/dashboard");
  }

  return <PitchDeckPrintView />;
}
