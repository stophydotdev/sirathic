import { create } from "zustand";

export const useThreadView = create<{ view: "answer" | "links" }>(() => ({ view: "answer" }));
