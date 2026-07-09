import LoginForm from "@/components/LoginForm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Login – TryCity" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="mx-auto mt-8 w-full max-w-md">
      <h1 className="text-center text-3xl font-bold tracking-tight">
        Mit Minecraft anmelden
      </h1>
      <p className="mt-2 text-center text-neutral-400">
        Du bekommst einen Code ingame in den Chat – kein Passwort nötig.
      </p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <LoginForm />
      </div>
    </div>
  );
}
