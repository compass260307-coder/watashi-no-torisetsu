import type { Guide } from '@/types/foundation';

export type { Guide } from '@/types/foundation';

export type Mood = 'clear' | 'calm' | 'mixed' | 'hard';

export type AnswerValue = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type DailyQuestion = {
  question_id: number;
  facet_id: string;
  dimension: 'E' | 'A' | 'O' | 'C' | 'N';
  text: string;
  logic_version: string;
};

export type DailyResultSummary = {
  daily_result_id: string;
  thirty_two_type_id: string;
  dimension_scores: Record<string, number>;
  minimum_boundary_distance: number;
  completed_at: string;
};

export type DailyStartResponse = {
  checkin: {
    id: string;
    status: 'in_progress' | 'completed';
    mood: Mood | null;
    local_date: string;
    started_at: string;
    completed_at: string | null;
  };
  cycle: {
    id: string;
    cycle_number: number;
    day_number: number;
    completed_days: number;
    starts_at: string;
    ends_at: string;
    timezone: string;
  };
  questions: DailyQuestion[];
  result: DailyResultSummary | null;
};

export type DailyCompleteResponse = {
  checkin_id: string;
  status: 'completed';
  cycle_id: string;
  cycle_day: number;
  completed_days: number;
  result: DailyResultSummary;
};

export type BootstrapResponse = {
  api_version: 'v1';
  min_supported_app_version: string;
  latest_app_version: string;
  maintenance_state: 'available' | 'maintenance';
  feature_flags: Record<string, boolean>;
  entitlement_state: 'none' | 'trialing' | 'active' | 'grace_period' | 'billing_issue' | 'expired';
  purchase_entitlements: {
    selfReport: boolean;
    full: boolean;
    premiumBundle: boolean;
    destinyFeatures: boolean;
    hoshiyomiChat: boolean;
    friendFeatures: boolean;
  };
  active_cycle: {
    id: string;
    cycle_number: number;
    day_number: number;
    completed_days: number;
    completed_day_numbers: number[];
    completed_today: boolean;
    starts_at: string;
    ends_at: string;
    timezone: string;
  } | null;
  account: {
    id: string;
    locale: string;
    timezone: string;
    guide: Guide;
    is_review_account: boolean;
    registered_at: string;
  };
  base_profile: {
    snapshot_id: string;
    logic_version: string;
    schema_version: number;
    copied_at: string;
    type_id: string;
    scores: Record<string, unknown>;
    facet_scores: Record<string, unknown> | null;
    self_report: Record<string, unknown> | null;
    perceived_report: Record<string, unknown> | null;
    friend_view: {
      base: {
        snapshotId: string;
        copiedAt: string;
        responseCount: number;
        scores: Record<string, number>;
        summary: string | null;
      } | null;
      live: null;
      displaySource: 'base' | 'none';
    };
  };
};

export type ChatMessageStatus = 'generating' | 'completed' | 'failed' | 'aborted';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: ChatMessageStatus;
  client_message_id: string | null;
  response_to_client_message_id: string | null;
  created_at: string;
  completed_at: string | null;
  error_code: string | null;
};

export type ChatMessagesResponse = {
  thread_id: string | null;
  messages: ChatMessage[];
};

export type ChatStreamMeta = {
  request_id: string;
  thread_id: string;
  user_message_id: string;
  assistant_message_id: string;
  duplicate: boolean;
};

export type ChatStreamDone = {
  assistant_message_id: string;
  content: string;
  finish_reason: string;
};

export type ChatMessageStatusResponse = {
  id: string;
  thread_id: string;
  content: string;
  status: ChatMessageStatus;
  completed_at: string | null;
  error_code: string | null;
};
