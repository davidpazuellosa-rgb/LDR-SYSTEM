"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Estado de salvamento da planilha (mostrado discretamente ao lado do título).
export type SavedStatus = { state: "saving" | "saved" | "error"; at: number } | null;

type TitleCtx = {
  title: string;
  setTitle: (t: string) => void;
  saved: SavedStatus;
  setSaved: (s: SavedStatus) => void;
};

const Ctx = createContext<TitleCtx>({
  title: "",
  setTitle: () => {},
  saved: null,
  setSaved: () => {},
});

export function TitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState<SavedStatus>(null);
  return <Ctx.Provider value={{ title, setTitle, saved, setSaved }}>{children}</Ctx.Provider>;
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
