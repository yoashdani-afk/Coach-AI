export type AnalysisPipelineMode = 'dense_timeline' | 'legacy';

/** Default: dense_timeline (development). Set ANALYSIS_PIPELINE=legacy to use single-pass video analysis. */
export function resolveAnalysisPipeline(): AnalysisPipelineMode {
  const value = process.env.ANALYSIS_PIPELINE?.trim().toLowerCase();
  if (value === 'legacy') return 'legacy';
  return 'dense_timeline';
}
