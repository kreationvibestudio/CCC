import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { isRegistrationOpen } from "@/lib/auth/actions";

export default async function RegisterPage() {
  if (!(await isRegistrationOpen())) {
    redirect("/login");
  }
  return <RegisterForm />;
}
