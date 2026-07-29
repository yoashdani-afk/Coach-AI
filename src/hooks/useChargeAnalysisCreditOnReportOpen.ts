import { useEffect, useRef } from 'react';
import type { CoachingReport } from '@/types/analysis';
import { useProfileStore } from '@/stores/profileStore';
import { useUploadStore } from '@/stores/uploadStore';

/**
 * Consumes one free analysis credit when a Gemini report screen opens successfully.
 * Skips demo fallbacks, duplicates, and dev builds.
 */
export function useChargeAnalysisCreditOnReportOpen(report: CoachingReport | null): void {
  const pendingBillableAnalysis = useUploadStore((s) => s.pendingBillableAnalysis);
  const clearPendingBillableAnalysis = useUploadStore((s) => s.clearPendingBillableAnalysis);
  const consumeAnalysisCreditForAttempt = useProfileStore((s) => s.consumeAnalysisCreditForAttempt);
  const chargedRef = useRef(false);

  useEffect(() => {
    chargedRef.current = false;
  }, [report?.id]);

  useEffect(() => {
    if (!report || chargedRef.current) return;
    if (report.analysisSource !== 'gemini') return;

    const pending = pendingBillableAnalysis;
    if (!pending || pending.reportId !== report.id || pending.source !== 'gemini') {
      return;
    }

    chargedRef.current = true;
    consumeAnalysisCreditForAttempt(pending.attemptId);
    clearPendingBillableAnalysis();
  }, [
    report,
    pendingBillableAnalysis,
    consumeAnalysisCreditForAttempt,
    clearPendingBillableAnalysis,
  ]);
}
