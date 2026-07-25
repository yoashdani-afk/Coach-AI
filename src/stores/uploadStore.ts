import { create } from 'zustand';
import type {
  AnalysisMode,
  ClipMetadata,
  CoachingQuestionType,
  CoachingReport,
  PlayerSelection,
} from '@/types/analysis';

interface UploadState {
  clip: ClipMetadata | null;
  analysisMode: AnalysisMode | null;
  playerSelection: PlayerSelection | null;
  questionType: CoachingQuestionType | null;
  customQuestion: string;
  context: string;
  pendingReport: CoachingReport | null;
  setClip: (clip: ClipMetadata | null) => void;
  setAnalysisMode: (mode: AnalysisMode | null) => void;
  setPlayerSelection: (selection: PlayerSelection | null) => void;
  setQuestionType: (type: CoachingQuestionType | null) => void;
  setCustomQuestion: (text: string) => void;
  setContext: (text: string) => void;
  setPendingReport: (report: CoachingReport | null) => void;
  clearDraft: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  clip: null,
  analysisMode: null,
  playerSelection: null,
  questionType: null,
  customQuestion: '',
  context: '',
  pendingReport: null,
  setClip: (clip) => set({ clip }),
  setAnalysisMode: (analysisMode) => set({ analysisMode }),
  setPlayerSelection: (playerSelection) => set({ playerSelection }),
  setQuestionType: (questionType) => set({ questionType }),
  setCustomQuestion: (customQuestion) => set({ customQuestion }),
  setContext: (context) => set({ context }),
  setPendingReport: (pendingReport) => set({ pendingReport }),
  clearDraft: () =>
    set({
      clip: null,
      analysisMode: null,
      playerSelection: null,
      questionType: null,
      customQuestion: '',
      context: '',
      pendingReport: null,
    }),
}));
