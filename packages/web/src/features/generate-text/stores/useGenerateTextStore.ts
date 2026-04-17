import { createWithEqualityFn as create } from 'zustand/traditional';

type GenerateTextState = {
  information: string;
  context: string;
  text: string;
};

type GenerateTextActions = {
  setInformation: (information: string) => void;
  setContext: (context: string) => void;
  setText: (text: string) => void;
  clear: () => void;
};

type GenerateTextStore = GenerateTextState & GenerateTextActions;

const initialState: GenerateTextState = {
  information: '',
  context: '',
  text: '',
};

export const useGenerateTextStore = create<GenerateTextStore>((set) => ({
  ...initialState,
  setInformation: (information) => set({ information }),
  setContext: (context) => set({ context }),
  setText: (text) => set({ text }),
  clear: () => set(initialState),
}));
