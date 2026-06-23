import { redirect } from "next/navigation";

export default function Home() {
  // A raiz sempre manda para o dashboard (o middleware cuida do login).
  redirect("/dashboard");
}
