"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function login(_prev: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "E-mail ou senha inválidos.";
    }
    // erros de redirect do Next precisam continuar subindo
    throw error;
  }
}
