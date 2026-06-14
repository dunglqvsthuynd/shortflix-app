import React, { createContext, useContext, useMemo } from "react";
import en, { Dict } from "./en";
import vi from "./vi";
import { Language } from "../types";

const DICTS: Record<Language, Dict> = { en, vi };

type Path = string; // dotted key, e.g. "nav.home"

function lookup(dict: Dict, path: Path): string {
  return path.split(".").reduce<any>((o, k) => (o == null ? o : o[k]), dict) ?? path;
}

interface Ctx {
  lang: Language;
  t: (path: Path) => string;
}
const LanguageCtx = createContext<Ctx>({ lang: "en", t: (p) => p });

export function LanguageProvider({ lang, children }: { lang: Language; children: React.ReactNode }) {
  const value = useMemo<Ctx>(() => ({ lang, t: (p) => lookup(DICTS[lang], p) }), [lang]);
  return <LanguageCtx.Provider value={value}>{children}</LanguageCtx.Provider>;
}

export function useT() {
  return useContext(LanguageCtx);
}
