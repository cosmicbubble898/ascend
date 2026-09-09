export const productivityCategories = [
  "Work",
  "Communication",
  "Learning",
  "Personal",
  "Uncategorized",
] as const;
export type ProductivityCategory = (typeof productivityCategories)[number];
export interface ProductivitySettings {
  details: boolean;
  excluded: string[];
  rules: Record<string, ProductivityCategory>;
  contextRules: ContextRule[];
  pausedUntil: number;
  goalMinutes: number;
  breakMinutes: number;
  aiModel: string;
  visionEnabled: boolean;
  visionDailyCap: number;
  activityAnalysisEnabled: boolean;
  profileName: string;
  profileRole: string;
  profileNotes: string;
}
export type Planning = "planned" | "unplanned" | "unspecified";
export interface ContextRule {
  id: string;
  app: string;
  pattern: string;
  category: ProductivityCategory;
  project: string;
  task: string;
  planning: Planning;
}
export interface TaskPlan {
  id: string;
  day: number;
  title: string;
  project: string;
  minutes: number;
  completed: number;
}
export interface FocusTimer {
  planId?: string;
  id?: string;
  phase?: "focus" | "break" | "complete";
  started?: number;
  end?: number;
  task?: string;
  project?: string;
  finishedPhase?: string;
}
export interface ProductivityReport {
  habits: { title: string; evidence: string; action: string }[];
  activeMs: number;
  focusMs: number;
  switches: number;
  previousActiveMs: number;
  previousFocusMs: number;
  previousObserved: boolean;
  planning: Record<Planning, number>;
  projects: { name: string; ms: number }[];
  categories: { name: string; ms: number }[];
  days: { day: string; ms: number; observed: boolean }[];
  goalMinutes: number;
  goalProgress: number;
  coaching: { title: string; evidence: string; action: string };
  workflows: {
    sequence: string[];
    count: number;
    evidence: string;
    action: string;
  }[];
}
export interface ActivityBlock {
  id: string;
  ids: string[];
  start: number;
  end: number;
  app: string;
  title: string;
  monitor: string;
  kind: "active" | "idle";
  category: ProductivityCategory;
  project: string;
  task: string;
  planning: Planning;
  reason: string;
  corrected: boolean;
  live: boolean;
  service: string;
  surface: string;
  visionSummary: string;
  visionConfidence: number;
  analysisConfidence: number;
  contextConfidence: number;
  domain: string;
  audioActive: boolean;
  audioOutput: boolean;
  audioInput: boolean;
  windowClass: string;
  aumid: string;
  evidenceSource: string;
}
export interface ProductivitySnapshot {
  startupStatus?: string;
  notificationStatus?: string;
  running: boolean;
  error: string;
  settings: ProductivitySettings;
  pausedUntil: number;
  now: number;
  focus: FocusTimer;
  plans: TaskPlan[];
  report: ProductivityReport;
  ai: {
    status: string;
    category?: ProductivityCategory;
    reason?: string;
    message?: string;
    model?: string;
    ids?: string[];
  };
  vision: {
    status: string;
    configured: boolean;
    enabled: boolean;
    model: string;
    lastAnalysis?: number;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    message?: string;
  };
  visionLog: {
    attempts: number;
    screenshots: number;
    successful: number;
    failed: number;
    inputTokens: number;
    outputTokens: number;
    estimatedUsd: number;
    entries: {
      observedAt: number;
      status: string;
      model: string;
      latencyMs: number;
      inputTokens: number;
      outputTokens: number;
      errorCode: string;
      screenshotCaptured: number;
      evidenceCommitted: number;
      imageDisposition: string;
      disposedAt: number;
    }[];
  };
  activityAnalysis: {
    status: string;
    configured: boolean;
    enabled: boolean;
    model: string;
    lastAnalysis?: number;
    labels?: number;
    message?: string;
  };
  activityAnalysisLog: {
    attempts: number;
    successful: number;
    failed: number;
    labels: number;
    inputTokens: number;
    outputTokens: number;
    estimatedUsd: number;
    entries: {
      observedAt: number;
      status: string;
      model: string;
      latencyMs: number;
      inputTokens: number;
      outputTokens: number;
      errorCode: string;
      labels: number;
    }[];
  };
  notices: { id: string; kind: string; title: string; body: string }[];
  current: {
    app: string;
    title: string;
    state: string;
    context: string;
    idle: boolean;
    audioActive: boolean;
    audioOutput: boolean;
    audioInput: boolean;
    windowClass: string;
    aumid: string;
  };
  lastSaved: number;
  storagePath: string;
  categories: ProductivityCategory[];
  rows: ActivityBlock[];
  totalRows: number;
  summary: {
    trackedMs: number;
    idleMs: number;
    focusMs: number;
    longestMs: number;
    switches: number;
    hourly: number[];
    apps: { name: string; ms: number }[];
    categories: { name: string; ms: number }[];
    insights: string[];
  };
}
export type ProductivityAction =
  | {
      action: "state" | "start" | "delete_day" | "break_start" | "focus_cancel";
    }
  | { action: "pause"; hours: number }
  | {
      action: "preferences";
      goalMinutes: number;
      breakMinutes: number;
      aiModel: string;
    }
  | ({ action: "context_rule" } & Omit<ContextRule, "id">)
  | { action: "remove_context_rule"; ruleId: string }
  | {
      action: "save_plan";
      planId: string;
      title: string;
      project: string;
      minutes: number;
      completed: boolean;
    }
  | { action: "delete_plan"; planId: string }
  | { action: "focus_start"; minutes: number; planId: string }
  | { action: "notice_seen"; noticeId: string }
  | { action: "ai_suggest"; ids: string[] }
  | { action: "apply_ai"; project: string; task: string; planning: Planning }
  | { action: "profile"; name: string; role: string; notes: string }
  | {
      action: "settings";
      settings: Pick<
        ProductivitySettings,
        "details" | "excluded" | "visionEnabled" | "activityAnalysisEnabled"
      >;
    }
  | {
      action: "correct";
      ids: string[];
      category: ProductivityCategory | null;
      project: string;
      task?: string;
      planning?: Planning;
    }
  | { action: "rule"; app: string; category: ProductivityCategory };
export type ProductivityCommand = ProductivityAction & {
  start: number;
  end: number;
  range?: "day" | "week";
};
export interface ProductivityBridge {
  request(command: ProductivityCommand): Promise<ProductivitySnapshot>;
}
