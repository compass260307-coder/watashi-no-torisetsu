export type FullAccessStatus = {
  full: boolean;
  selfReport: boolean;
  friend: boolean;
  premiumBundle: boolean;
  astrologer: boolean;
  unmei: boolean;
  tarot: boolean;
};

export const EMPTY_FULL_ACCESS_STATUS: FullAccessStatus = {
  full: false,
  selfReport: false,
  friend: false,
  premiumBundle: false,
  astrologer: false,
  unmei: false,
  tarot: false,
};
