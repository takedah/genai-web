import { createWithEqualityFn as create } from 'zustand/traditional';
import { LANGUAGES } from '../constants';

type TranslateState = {
  sentence: string;
  additionalContext: string;
  language: string;
  translatedSentence: string;
};

type TranslateActions = {
  setSentence: (sentence: string) => void;
  setAdditionalContext: (additionalContext: string) => void;
  setLanguage: (language: string) => void;
  setTranslatedSentence: (translatedSentence: string) => void;
  clear: () => void;
};

type TranslateStore = TranslateState & TranslateActions;

const initialState: TranslateState = {
  sentence: '',
  additionalContext: '',
  language: LANGUAGES[0],
  translatedSentence: '',
};

export const useTranslateStore = create<TranslateStore>((set) => ({
  ...initialState,
  setSentence: (sentence) => set({ sentence }),
  setAdditionalContext: (additionalContext) => set({ additionalContext }),
  setLanguage: (language) => set({ language }),
  setTranslatedSentence: (translatedSentence) => set({ translatedSentence }),
  clear: () => set(initialState),
}));
