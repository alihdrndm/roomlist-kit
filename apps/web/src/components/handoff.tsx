"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";

// Lets one page hand a file to another without uploading it again: "Compare with a
// newer version" on Validate, "Open in Validate" on Compare. Files live in memory in
// this browser tab only (never in browser storage), and a handoff is read once.

export type Handoff =
  | { to: "compare"; before: File }
  | { to: "validate"; file: File };

type HandoffApi = {
  give: (handoff: Handoff) => void;
  take: <T extends Handoff["to"]>(
    to: T,
  ) => Extract<Handoff, { to: T }> | undefined;
};

const HandoffContext = createContext<HandoffApi | undefined>(undefined);

export function HandoffProvider({ children }: { children: ReactNode }) {
  const pending = useRef<Handoff | undefined>(undefined);
  const give = useCallback((handoff: Handoff) => {
    pending.current = handoff;
  }, []);
  const take = useCallback(
    <T extends Handoff["to"]>(
      to: T,
    ): Extract<Handoff, { to: T }> | undefined => {
      const current = pending.current;
      if (current === undefined || current.to !== to) return undefined;
      pending.current = undefined;
      return current as Extract<Handoff, { to: T }>;
    },
    [],
  );
  const api = useMemo(() => ({ give, take }), [give, take]);
  return (
    <HandoffContext.Provider value={api}>{children}</HandoffContext.Provider>
  );
}

export function useHandoff(): HandoffApi {
  const api = useContext(HandoffContext);
  if (api === undefined)
    throw new Error("useHandoff must be used inside HandoffProvider");
  return api;
}
