import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformOperatorUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const supabase = await createClient();
  const {
    data: { user: auth },
  } = await supabase.auth.getUser();
  if (auth?.email && (await isPlatformOperatorUser(auth.id, auth.email))) {
    redirect("/platform");
  }
  redirect("/login");
}
