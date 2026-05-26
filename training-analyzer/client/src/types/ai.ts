export type HighlightKind = 'positive' | 'neutral' | 'concern';
export type SuggestionPriority = 'high' | 'med' | 'low';
export type HistoryTrend = 'up' | 'flat' | 'down' | 'n/a';

export interface AnalysisHighlight {
  kind: HighlightKind;
  text: string;
}

export interface AnalysisSuggestion {
  priority: SuggestionPriority;
  text: string;
}

export interface AnalysisHistoryComparison {
  trend: HistoryTrend;
  notes: string;
}

export interface WorkoutAnalysis {
  source?: 'rules' | 'ai';
  summary: string;
  type_classification: string;
  highlights: AnalysisHighlight[];
  suggestions: AnalysisSuggestion[];
  comparison_to_history: AnalysisHistoryComparison;
  confidence: number;
}

export interface RenderAnalysisOptions {
  title?: string;
  badge?: string | null;
  variant?: 'rules' | 'ai';
  actions?: string;
}
