"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Estado de salvamento da planilha (mostrado discretamente ao lado do título).
export type SavedStatus = { state: "saving" | "saved" | "error"; at: number } | null;

// Trilha de navegação (migalhas) clicável mostrada acima do título.
export type Trilha = { label: string; href?: string }[];

type TitleCtx = {
  title: string;
  setTitle: (t: string) => void;
  trail: Trilha;
  setTrail: (t: Trilha) => void;
  saved: SavedStatus;
  setSaved: (s: SavedStatus) => void;
};

const Ctx = createContext<TitleCtx>({
  title: "",
  setTitle: () => {},
  trail: [],
  setTrail: () => {},
  saved: null,
  setSaved: () => {},
});

export function TitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState("");
  const [trail, setTrail] = useState<Trilha>([]);
  const [saved, setSaved] = useState<SavedStatus>(null);
  return <Ctx.Provider value={{ title, setTitle, trail, setTrail, saved, setSaved }}>{children}</Ctx.Provider>;
}

export function useTitle() {
  return useContext(Ctx);
}

// Componente "invisível": cada página o renderiza para definir o título da barra de topo.
export function PageTitle({ title, trail }: { title: string; trail?: Trilha }) {
  const { setTitle, setTrail } = useTitle();
  const chave = trail ? JSON.stringify(trail) : "";
  useEffect(() => {
    setTitle(title);
    setTrail(chave ? (JSON.parse(chave) as Trilha) : []);
    return () => setTrail([]);
  }, [title, chave, setTitle, setTrail]);
  return null;
}
