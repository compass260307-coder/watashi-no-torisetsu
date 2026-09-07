export const LINE_ALICE_CLIENT_EVENT_NAMES = [
  "line_alice_card_viewed",
  "line_alice_add_friend_clicked",
  "line_alice_link_code_requested",
  "line_alice_link_code_issued",
  "line_alice_link_code_failed",
] as const;

export const LINE_ALICE_FUNNEL_EVENT_NAMES = [
  ...LINE_ALICE_CLIENT_EVENT_NAMES,
  "line_link_completed",
] as const;

export type LineAliceClientEventName =
  (typeof LINE_ALICE_CLIENT_EVENT_NAMES)[number];

export type LineAliceTrackingSource =
  | "hoshiyomi_home"
  | "hoshiyomi_paywall_exit"
  | "bottom_nav_alice_paywall_exit"
  | "bottom_nav_unmei_paywall_exit";

export type LineAliceTrackingMetadata = {
  source: LineAliceTrackingSource;
  variant: "conversation" | "fortune";
  flow?: "liff" | "manual";
  kind?: "liff" | "manual";
  http_status?: number;
  error_code?: string;
};
