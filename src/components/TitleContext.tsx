"use client";

import { createContext, useContext, useEffect, useState } from "react";

type TitleCtx = { title: string; setTitle: (t: string) => void };

const Ctx = createContext<TitleCtx>({ title: "", setTitle: () => {} });

export function TitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState("");
  return <Ctx.Provider value={{ title, setTitle }}>{children}</Ctx.Provider>;
}

export function useTitle() {
  return useContext(Ctx);
}

// Componente "invisível": cada página o renderiza para definir o título da barra de topo.
export function PageTitle({ title }: { title: string }) {
  const { setTitle } = useTitle();
  useEffect(() => {
    setTitle(title);
  }, [title, setTitle]);
  return null;
}
