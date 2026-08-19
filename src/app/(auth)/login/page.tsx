import { LoginForm } from "@/components/auth/login-form";
import { isRegistrationOpen } from "@/lib/auth/actions";

export default async function LoginPage() {
  const allowRegister = await isRegistrationOpen();
  return <LoginForm allowRegister={allowRegister} />;
}
