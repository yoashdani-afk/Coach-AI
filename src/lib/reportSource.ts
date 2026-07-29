import type { CoachingReport, ReportAnalysisSource } from '@/types/analysis';

export function resolveReportSource(report: CoachingReport): ReportAnalysisSource {
  if (report.analysisSource) return report.analysisSource;
  return report.isDemo ? 'demo' : 'gemini';
}

export function reportSourceLabel(report: CoachingReport): string {
  return resolveReportSource(report) === 'gemini'
    ? 'Source: Gemini Video Analysis'
    : 'Source: Demo Feedback';
}

export function reportOverallScoreLabel(report: CoachingReport): string {
  return resolveReportSource(report) === 'gemini' ? 'Overall Score' : 'Demo Score';
}

export function isGeminiAnalysedReport(report: CoachingReport): boolean {
  return resolveReportSource(report) === 'gemini';
}
