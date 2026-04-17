import { createWithEqualityFn as create } from 'zustand/traditional';

type ChatState = {
  content: string;
  inputSystemContext: string;
  saveSystemContext: string;
  isDragOver: boolean;
  shouldAutoSubmit: boolean;
};

type ChatActions = {
  setContent: (content: string) => void;
  setInputSystemContext: (inputSystemContext: string) => void;
  setSaveSystemContext: (saveSystemContext: string) => void;
  setIsDragOver: (isDragOver: boolean) => void;
  setShouldAutoSubmit: (shouldAutoSubmit: boolean) => void;
};

type ChatStore = ChatState & ChatActions;

const initialState: ChatState = {
  content: '',
  inputSystemContext: '',
  saveSystemContext: '',
  isDragOver: false,
  shouldAutoSubmit: false,
};

export const useChatStore = create<ChatStore>((set) => ({
  ...initialState,
  setContent: (content) => set({ content }),
  setInputSystemContext: (inputSystemContext) => set({ inputSystemContext }),
  setSaveSystemContext: (saveSystemContext) => set({ saveSystemContext }),
  setIsDragOver: (isDragOver) => set({ isDragOver }),
  setShouldAutoSubmit: (shouldAutoSubmit) => set({ shouldAutoSubmit }),
}));
