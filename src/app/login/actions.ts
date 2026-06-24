"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function login(_prev: string | undefined, formData: FormData) {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "E-mail ou senha inválidos. Confirme se está usando um usuário cadastrado.";
    }
    // erros de redirect do Next precisam continuar subindo
    throw error;
  }
}
