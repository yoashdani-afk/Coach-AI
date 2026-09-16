import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export interface AnalysisUsageSnapshot {
  used: number;
  remaining: number;
  limit: number;
  periodStart: string;
  periodEnd: string;
}

function parseUsage(raw: unknown): AnalysisUsageSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const used = typeof obj.used === 'number' ? obj.used : null;
  const remaining = typeof obj.remaining === 'number' ? obj.remaining : null;
  const limit = typeof obj.limit === 'number' ? obj.limit : null;
  if (used == null || remaining == null || limit == null) return null;

  return {
    used,
    remaining,
    limit,
    periodStart: typeof obj.period_start === 'string' ? obj.period_start : '',
    periodEnd: typeof obj.period_end === 'string' ? obj.period_end : '',
  };
}

export async function fetchAnalysisUsage(
  monthlyLimit: number = FREE_TIER_ANALYSES_PER_MONTH
): Promise<AnalysisUsageSnapshot | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getSupabase().rpc('get_analysis_usage', {
    p_monthly_limit: monthlyLimit,
  });

  if (error) {
    console.warn('[Credits] get_analysis_usage failed', error.message);
    return null;
  }

  return parseUsage(data);
}

export type ConsumeAnalysisCreditResult =
  | { ok: true; duplicate: boolean; usage: AnalysisUsageSnapshot }
  | { ok: false; reason: 'limit_reached' | 'error'; message?: string; usage?: AnalysisUsageSnapshot };

export async function consumeAnalysisCreditRemote(
  attemptId: string,
  monthlyLimit: number = FREE_TIER_ANALYSES_PER_MONTH
): Promise<ConsumeAnalysisCreditResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, reason: 'error', message: 'Supabase is not configured.' };
  }

  const { data, error } = await getSupabase().rpc('consume_analysis_credit', {
    p_attempt_id: attemptId,
    p_monthly_limit: monthlyLimit,
  });

  if (error) {
    console.warn('[Credits] consume_analysis_credit failed', error.message);
    return { ok: false, reason: 'error', message: error.message };
  }

  const usage = parseUsage(data);
  if (!usage) {
    return { ok: false, reason: 'error', message: 'Invalid usage response.' };
  }

  const record = data as Record<string, unknown>;
  if (record.ok === false || record.reason === 'limit_reached') {
    return { ok: false, reason: 'limit_reached', usage };
  }

  return {
    ok: true,
    duplicate: Boolean(record.duplicate),
    usage,
  };
}

export type ResetMyAnalysisUsageResult =
  | { ok: true; usage: AnalysisUsageSnapshot }
  | { ok: false; message: string };

/** Resets the signed-in user's own analyses_used_this_month via SECURITY DEFINER RPC. */
export async function resetMyAnalysisUsageRemote(
  monthlyLimit: number = FREE_TIER_ANALYSES_PER_MONTH
): Promise<ResetMyAnalysisUsageResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  const { data, error } = await getSupabase().rpc('reset_my_analysis_usage', {
    p_monthly_limit: monthlyLimit,
  });

  if (error) {
    console.warn('[Credits] reset_my_analysis_usage failed', error.message);
    return { ok: false, message: error.message };
  }

  const usage = parseUsage(data);
  if (!usage) {
    return { ok: false, message: 'Invalid usage response.' };
  }

  return { ok: true, usage };
}

/**
 * Align the signed-in user's analysis period to an anniversary anchor (UTC date YYYY-MM-DD).
 * Pass resetUsed=true when Pro first activates so they get a full Pro allotment.
 */
export async function syncAnalysisPeriodAnchorRemote(
  anchorIsoDate: string,
  resetUsed: boolean,
  monthlyLimit: number = FREE_TIER_ANALYSES_PER_MONTH
): Promise<AnalysisUsageSnapshot | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getSupabase().rpc('sync_analysis_period_anchor', {
    p_anchor: anchorIsoDate,
    p_reset_used: resetUsed,
    p_monthly_limit: monthlyLimit,
  });

  if (error) {
    console.warn('[Credits] sync_analysis_period_anchor failed', error.message);
    return null;
  }

  return parseUsage(data);
}
