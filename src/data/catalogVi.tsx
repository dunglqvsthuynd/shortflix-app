import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useT } from "../i18n";
import { translateTexts } from "./mt";
import { Movie } from "../types";

// Movie TITLES are shown as-is: the Vietnamese catalog (viNative) already has Vietnamese
// titles, and the English catalog keeps its original English titles (no machine translation
// — MT garbled proper names). Only SYNOPSES are machine-translated, lazily per detail view.

const SYN_PREFIX = "vi_syn_v1:";

interface ViCtx {
  isVi: boolean;
  title: (m: Movie) => string;
  synopsis: (m: Movie) => string;
  ensureSynopsis: (m: Movie) => void;
}

const Ctx = createContext<ViCtx>({
  isVi: false,
  title: (m) => m.title,
  synopsis: (m) => m.synopsis,
  ensureSynopsis: () => {},
});

export function ViCatalogProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useT();
  const isVi = lang === "vi";
  const [synopses, setSynopses] = useState<Record<string, string>>({});
  const pending = useRef<Set<string>>(new Set());

  // Translate one movie's synopsis on demand (called from the detail screen).
  const ensureSynopsis = useCallback(
    (m: Movie) => {
      if (!isVi || !m.synopsis || synopses[m.id] || pending.current.has(m.id)) return;
      pending.current.add(m.id);
      (async () => {
        let vi = "";
        try {
          vi = (await AsyncStorage.getItem(SYN_PREFIX + m.id)) || "";
        } catch {
          // ignore
        }
        if (!vi) {
          const out = await translateTexts([m.synopsis]);
          vi = out[0] || m.synopsis;
          AsyncStorage.setItem(SYN_PREFIX + m.id, vi).catch(() => {});
        }
        pending.current.delete(m.id);
        setSynopses((s) => ({ ...s, [m.id]: vi }));
      })();
    },
    [isVi, synopses]
  );

  const value: ViCtx = {
    isVi,
    title: (m) => m.title,
    synopsis: (m) => (isVi ? synopses[m.id] ?? m.synopsis : m.synopsis),
    ensureSynopsis,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useViCatalog() {
  return useContext(Ctx);
}
