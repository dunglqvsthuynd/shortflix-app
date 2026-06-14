import React, { createContext, useContext, useEffect, useReducer, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { reducer, initialState, State, Action } from "./reducer";

export { reducer, initialState } from "./reducer";
export type { State, Action } from "./reducer";

const PERSIST_KEY = "shortflix-state-v1";

interface StoreCtx {
  state: State;
  dispatch: React.Dispatch<Action>;
}
const StoreContext = createContext<StoreCtx>({ state: initialState, dispatch: () => {} });

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PERSIST_KEY);
        if (raw) dispatch({ type: "hydrate", state: JSON.parse(raw) });
        else dispatch({ type: "hydrate", state: {} });
      } catch {
        dispatch({ type: "hydrate", state: {} });
      }
      loaded.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current || !state.hydrated) return;
    const { hydrated, ...persist } = state;
    AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(persist)).catch(() => {});
  }, [state]);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
