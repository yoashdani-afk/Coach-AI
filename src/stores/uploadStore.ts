import { create } from 'zustand';
import type {
  AnalysisMode,
  ClipMetadata,
  CoachingQuestionType,
  CoachingReport,
  PlayerSelection,
} from '@/types/analysis';
import type { HallOfFameUnlockPreview } from '@/types/hallOfFame';
import type { ReportAnalysisSource } from '@/types/analysis';

export interface PendingBillableAnalysis {
  attemptId: string;
  reportId: string;
  source: ReportAnalysisSource;
}

interface UploadState {
  clip: ClipMetadata | null;
  analysisMode: AnalysisMode | null;
  playerSelection: PlayerSelection | null;
  playerTracking: import('@/types/analysis').PlayerTrackingData | null;
  questionType: CoachingQuestionType | null;
  customQuestion: string;
  context: string;
  pendingReport: CoachingReport | null;
  pendingHallOfFameUnlock: HallOfFameUnlockPreview | null;
  analysisAttemptId: string | null;
  pendingBillableAnalysis: PendingBillableAnalysis | null;
  setClip: (clip: ClipMetadata | null) => void;
  setAnalysisMode: (mode: AnalysisMode | null) => void;
  setPlayerSelection: (selection: PlayerSelection | null) => void;
  setPlayerTracking: (tracking: import('@/types/analysis').PlayerTrackingData | null) => void;
  setQuestionType: (type: CoachingQuestionType | null) => void;
  setCustomQuestion: (text: string) => void;
  setContext: (text: string) => void;
  setPendingReport: (report: CoachingReport | null) => void;
  setPendingHallOfFameUnlock: (unlock: HallOfFameUnlockPreview | null) => void;
  setAnalysisAttemptId: (attemptId: string | null) => void;
  setPendingBillableAnalysis: (pending: PendingBillableAnalysis | null) => void;
  clearPendingBillableAnalysis: () => void;
  clearDraft: () => void;
  clearHallOfFameUnlock: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  clip: null,
  analysisMode: null,
  playerSelection: null,
  playerTracking: null,
  questionType: null,
  customQuestion: '',
  context: '',
  pendingReport: null,
  pendingHallOfFameUnlock: null,
  analysisAttemptId: null,
  pendingBillableAnalysis: null,
  setClip: (clip) => set({ clip }),
  setAnalysisMode: (analysisMode) => set({ analysisMode }),
  setPlayerSelection: (playerSelection) => set({ playerSelection }),
  setPlayerTracking: (playerTracking) => set({ playerTracking }),
  setQuestionType: (questionType) => set({ questionType }),
  setCustomQuestion: (customQuestion) => set({ customQuestion }),
  setContext: (context) => set({ context }),
  setPendingReport: (pendingReport) => set({ pendingReport }),
  setPendingHallOfFameUnlock: (pendingHallOfFameUnlock) => set({ pendingHallOfFameUnlock }),
  setAnalysisAttemptId: (analysisAttemptId) => set({ analysisAttemptId }),
  setPendingBillableAnalysis: (pendingBillableAnalysis) => set({ pendingBillableAnalysis }),
  clearPendingBillableAnalysis: () => set({ pendingBillableAnalysis: null }),
  clearDraft: () =>
    set({
      clip: null,
      analysisMode: null,
      playerSelection: null,
      playerTracking: null,
      questionType: null,
      customQuestion: '',
      context: '',
      pendingReport: null,
      analysisAttemptId: null,
    }),
  clearHallOfFameUnlock: () => set({ pendingHallOfFameUnlock: null }),
}));
