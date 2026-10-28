import { create } from "zustand";

export const useOpenSources = create<{ id: string | undefined }>(() => ({ id: undefined }));
