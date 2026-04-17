import { createWithEqualityFn as create } from 'zustand/traditional';
import type { DiagramType, MermaidDiagramType } from '@/features/generate-diagram/types';

type DiagramState = {
  content: string;
  diagramCode: string;
  diagramSentence: string;
  selectedType: DiagramType;
  diagramGenerationError: Error | null;
  /** AI が決定したダイアグラムタイプ（API 結果） */
  diagramType: MermaidDiagramType | '';
};

type DiagramActions = {
  setContent: (content: string) => void;
  setDiagramCode: (diagramCode: string) => void;
  setDiagramSentence: (diagramSentence: string) => void;
  setSelectedType: (selectedType: DiagramType) => void;
  setDiagramGenerationError: (diagramGenerationError: Error | null) => void;
  setDiagramType: (diagramType: MermaidDiagramType | '') => void;
  clear: () => void;
};

type DiagramStore = DiagramState & DiagramActions;

const initialState: DiagramState = {
  content: '',
  diagramCode: '',
  diagramSentence: '',
  selectedType: 'AI',
  diagramGenerationError: null,
  diagramType: '',
};

export const useDiagramStore = create<DiagramStore>((set) => ({
  ...initialState,
  setContent: (content) => set({ content }),
  setDiagramCode: (diagramCode) => set({ diagramCode }),
  setDiagramSentence: (diagramSentence) => set({ diagramSentence }),
  setSelectedType: (selectedType) => set({ selectedType }),
  setDiagramGenerationError: (diagramGenerationError) => set({ diagramGenerationError }),
  setDiagramType: (diagramType) => set({ diagramType }),
  clear: () => set(initialState),
}));
