import { useEffect, useRef } from 'react';
import type { CoachingReport } from '@/types/analysis';
import { getAnalysisLimit } from '@/lib/entitlements';
import { useIsPro } from '@/stores/entitlementStore';
import { useProfileStore } from '@/stores/profileStore';
import { useUploadStore } from '@/stores/uploadStore';

/**
 * Consumes one analysis credit when a Gemini report screen opens successfully.
 * Skips demo fallbacks, duplicates, and dev builds. Charges via Supabase RPC.
 */
export function useChargeAnalysisCreditOnReportOpen(report: CoachingReport | null): void {
  const pendingBillableAnalysis = useUploadStore((s) => s.pendingBillableAnalysis);
  const clearPendingBillableAnalysis = useUploadStore((s) => s.clearPendingBillableAnalysis);
  const consumeAnalysisCreditForAttempt = useProfileStore((s) => s.consumeAnalysisCreditForAttempt);
  const isPro = useIsPro();
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
    const monthlyLimit = getAnalysisLimit(isPro);
    void (async () => {
      await consumeAnalysisCreditForAttempt(pending.attemptId, monthlyLimit);
      clearPendingBillableAnalysis();
    })();
  }, [
    report,
    pendingBillableAnalysis,
    consumeAnalysisCreditForAttempt,
    clearPendingBillableAnalysis,
    isPro,
  ]);
}
