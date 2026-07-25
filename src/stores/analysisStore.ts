import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AnalysisMode, CoachingReport } from '@/types/analysis';

interface AnalysisState {
  reports: CoachingReport[];
  isAnalysing: boolean;
  hasHydrated: boolean;
  setIsAnalysing: (value: boolean) => void;
  addReport: (report: CoachingReport) => void;
  getReport: (id: string) => CoachingReport | undefined;
  setHasHydrated: (value: boolean) => void;
}

function isValidReport(report: unknown): report is CoachingReport {
  if (!report || typeof report !== 'object') return false;
  const r = report as CoachingReport;
  const hasPlayerSelection =
    r.playerSelection &&
    typeof r.playerSelection.normalizedX === 'number' &&
    typeof r.playerSelection.normalizedY === 'number';
  return (
    typeof r.id === 'string' &&
    typeof r.title === 'string' &&
    typeof r.summary === 'string' &&
    typeof r.mode === 'string' &&
    (r.mode === 'COACH_ME' || r.mode === 'PERFORMANCE' || r.mode === 'GOAL') &&
    hasPlayerSelection
  );
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set, get) => ({
      reports: [],
      isAnalysing: false,
      hasHydrated: false,
      setIsAnalysing: (value) => set({ isAnalysing: value }),
      addReport: (report) =>
        set((state) => ({
          reports: [report, ...state.reports],
        })),
      getReport: (id) => get().reports.find((r) => r.id === id),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'coach-ai-reports',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ reports: state.reports }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.reports = state.reports.filter(isValidReport);
        }
        state?.setHasHydrated(true);
      },
    }
  )
);

export function getLatestReport(reports: CoachingReport[]): CoachingReport | null {
  if (reports.length === 0) return null;
  return [...reports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
}

export function getModeCounts(
  reports: CoachingReport[]
): { mode: AnalysisMode; count: number }[] {
  const counts = new Map<AnalysisMode, number>();
  for (const report of reports) {
    counts.set(report.mode, (counts.get(report.mode) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count);
}
