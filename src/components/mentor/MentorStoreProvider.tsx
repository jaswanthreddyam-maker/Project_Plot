/**
 * MentorStoreProvider — Context-based Zustand store isolation
 *
 * Creates a stable store instance via useRef, scoped to the
 * mentor overlay subtree. Prevents singleton leakage.
 */
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createMentorStore, type MentorStore, type MentorState } from "@/store/mentorStore";

const MentorStoreContext = createContext<MentorStore | null>(null);

export function MentorStoreProvider({ children }: { children: ReactNode }) {
    const [store] = useState<MentorStore>(() => createMentorStore());

    return (
        <MentorStoreContext.Provider value={store}>
            {children}
        </MentorStoreContext.Provider>
    );
}

export function useMentorStore<T>(selector: (state: MentorState) => T): T {
    const store = useContext(MentorStoreContext);
    if (!store) {
        throw new Error("useMentorStore must be used within <MentorStoreProvider>");
    }
    return useStore(store, selector);
}
