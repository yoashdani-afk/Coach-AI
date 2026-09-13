import type {
  ClipMetadata,
  GoalReport,
  PlayerSelection,
  ReportAnalysisSource,
  ScoredCategory,
} from '@/types/analysis';

/**
 * Public Goal report payload stored in hall_of_fame_entries.report_snapshot.
 * Intentionally omits: identityProfile, profile PII, analysisFallbackReason, chat.
 */
export interface PublicGoalPlayerSelection {
  normalizedX: number;
  normalizedY: number;
  timestampMs: number;
  displayWidth: number;
  displayHeight: number;
  videoWidth?: number;
  videoHeight?: number;
}

export interface PublicGoalReportSnapshot {
  id: string;
  createdAt: string;
  mode: 'GOAL';
  title: string;
  summary: string;
  isDemo: boolean;
  analysisSource?: ReportAnalysisSource;
  clip: ClipMetadata;
  playerSelection: PublicGoalPlayerSelection;
  overallScore: number;
  categories: ScoredCategory[];
  whyScoredThisWay: string;
  excellentPoint: string;
  couldBeBetter: string;
  whatHappened?: string;
  whyItMattered?: string;
  betterOption?: string;
  professionalInsight?: string;
}

function minimalPlayerSelection(selection: PlayerSelection): PublicGoalPlayerSelection {
  const out: PublicGoalPlayerSelection = {
    normalizedX: selection.normalizedX,
    normalizedY: selection.normalizedY,
    timestampMs: selection.timestampMs,
    displayWidth: selection.displayWidth,
    displayHeight: selection.displayHeight,
  };
  if (selection.videoWidth != null) out.videoWidth = selection.videoWidth;
  if (selection.videoHeight != null) out.videoHeight = selection.videoHeight;
  return out;
}

/** Build a public snapshot from a local Goal report + public video URL. */
export function buildPublicGoalReportSnapshot(
  report: GoalReport,
  publicClipUri: string
): PublicGoalReportSnapshot {
  const snapshot: PublicGoalReportSnapshot = {
    id: report.id,
    createdAt: report.createdAt,
    mode: 'GOAL',
    title: report.title,
    summary: report.summary,
    isDemo: report.isDemo,
    clip: {
      uri: publicClipUri,
      durationMs: report.clip.durationMs,
      fileName: report.clip.fileName,
      fileSizeBytes: report.clip.fileSizeBytes,
    },
    playerSelection: minimalPlayerSelection(report.playerSelection),
    overallScore: report.overallScore,
    categories: report.categories,
    whyScoredThisWay: report.whyScoredThisWay,
    excellentPoint: report.excellentPoint,
    couldBeBetter: report.couldBeBetter,
  };

  if (report.analysisSource) snapshot.analysisSource = report.analysisSource;
  if (report.whatHappened?.trim()) snapshot.whatHappened = report.whatHappened;
  if (report.whyItMattered?.trim()) snapshot.whyItMattered = report.whyItMattered;
  if (report.betterOption?.trim()) snapshot.betterOption = report.betterOption;
  if (report.professionalInsight?.trim()) {
    snapshot.professionalInsight = report.professionalInsight;
  }

  return snapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse JSON from Supabase into a typed snapshot, or null if missing/invalid. */
export function parsePublicGoalReportSnapshot(
  raw: unknown
): PublicGoalReportSnapshot | null {
  if (!isRecord(raw)) return null;
  if (raw.mode !== 'GOAL') return null;
  if (typeof raw.id !== 'string' || typeof raw.createdAt !== 'string') return null;
  if (typeof raw.title !== 'string' || typeof raw.summary !== 'string') return null;
  if (typeof raw.isDemo !== 'boolean') return null;
  if (typeof raw.overallScore !== 'number') return null;
  if (typeof raw.whyScoredThisWay !== 'string') return null;
  if (typeof raw.excellentPoint !== 'string') return null;
  if (typeof raw.couldBeBetter !== 'string') return null;
  if (!isRecord(raw.clip) || typeof raw.clip.uri !== 'string') return null;
  if (!isRecord(raw.playerSelection)) return null;
  if (!Array.isArray(raw.categories)) return null;

  const clip: ClipMetadata = {
    uri: String(raw.clip.uri),
    durationMs: typeof raw.clip.durationMs === 'number' ? raw.clip.durationMs : 0,
    fileName: typeof raw.clip.fileName === 'string' ? raw.clip.fileName : null,
    fileSizeBytes:
      typeof raw.clip.fileSizeBytes === 'number' ? raw.clip.fileSizeBytes : null,
  };

  const ps = raw.playerSelection;
  const playerSelection: PublicGoalPlayerSelection = {
    normalizedX: typeof ps.normalizedX === 'number' ? ps.normalizedX : 0.5,
    normalizedY: typeof ps.normalizedY === 'number' ? ps.normalizedY : 0.5,
    timestampMs: typeof ps.timestampMs === 'number' ? ps.timestampMs : 0,
    displayWidth: typeof ps.displayWidth === 'number' ? ps.displayWidth : 1,
    displayHeight: typeof ps.displayHeight === 'number' ? ps.displayHeight : 1,
  };
  if (typeof ps.videoWidth === 'number') playerSelection.videoWidth = ps.videoWidth;
  if (typeof ps.videoHeight === 'number') playerSelection.videoHeight = ps.videoHeight;

  const snapshot: PublicGoalReportSnapshot = {
    id: raw.id,
    createdAt: raw.createdAt,
    mode: 'GOAL',
    title: raw.title,
    summary: raw.summary,
    isDemo: raw.isDemo,
    clip,
    playerSelection,
    overallScore: raw.overallScore,
    categories: raw.categories as ScoredCategory[],
    whyScoredThisWay: raw.whyScoredThisWay,
    excellentPoint: raw.excellentPoint,
    couldBeBetter: raw.couldBeBetter,
  };

  if (raw.analysisSource === 'gemini' || raw.analysisSource === 'demo') {
    snapshot.analysisSource = raw.analysisSource;
  }
  if (typeof raw.whatHappened === 'string') snapshot.whatHappened = raw.whatHappened;
  if (typeof raw.whyItMattered === 'string') snapshot.whyItMattered = raw.whyItMattered;
  if (typeof raw.betterOption === 'string') snapshot.betterOption = raw.betterOption;
  if (typeof raw.professionalInsight === 'string') {
    snapshot.professionalInsight = raw.professionalInsight;
  }

  return snapshot;
}

/** Hydrate a GoalReport for ReportDetailView from a public snapshot. */
export function snapshotToGoalReport(snapshot: PublicGoalReportSnapshot): GoalReport {
  const report: GoalReport = {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    isDemo: snapshot.isDemo,
    clip: snapshot.clip,
    mode: 'GOAL',
    title: snapshot.title,
    summary: snapshot.summary,
    playerSelection: { ...snapshot.playerSelection },
    overallScore: snapshot.overallScore,
    categories: snapshot.categories,
    whyScoredThisWay: snapshot.whyScoredThisWay,
    excellentPoint: snapshot.excellentPoint,
    couldBeBetter: snapshot.couldBeBetter,
  };

  if (snapshot.analysisSource) report.analysisSource = snapshot.analysisSource;
  if (snapshot.whatHappened) report.whatHappened = snapshot.whatHappened;
  if (snapshot.whyItMattered) report.whyItMattered = snapshot.whyItMattered;
  if (snapshot.betterOption) report.betterOption = snapshot.betterOption;
  if (snapshot.professionalInsight) report.professionalInsight = snapshot.professionalInsight;

  return report;
}
