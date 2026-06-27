"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Marca as sugestões como "vistas" ao abrir a página: grava o momento num cookie
// e atualiza o layout (badge/ponto da sidebar some). Reaparece só quando chegar
// uma sugestão criada DEPOIS deste momento.
export default function MarkSuggestionsSeen() {
  const router = useRouter();
  useEffect(() => {
    document.cookie = `sug_seen_at=${Date.now()}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }, [router]);
  return null;
}
