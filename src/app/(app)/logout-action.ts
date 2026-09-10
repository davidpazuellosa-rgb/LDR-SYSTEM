"use server";

import { signOut } from "@/auth";
import { appBasePath } from "@/lib/path";

export async function logout() {
  await signOut({ redirectTo: `${appBasePath()}/login` });
}
