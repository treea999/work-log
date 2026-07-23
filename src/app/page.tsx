import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-server";

export default async function Home() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  redirect("/dashboard");
}
