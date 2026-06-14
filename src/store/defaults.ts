import { UserProfile, CheckInDay } from "../types";

export const DEFAULT_USER: UserProfile = {
  name: "Alex Rivera",
  role: "member",
  avatarUrl: "https://i.pravatar.cc/150?img=12",
  isVip: false,
  coins: 150,
};

export const DEFAULT_CHECK_IN: CheckInDay[] = [
  { day: 1, coins: 10, isClaimed: false },
  { day: 2, coins: 10, isClaimed: false },
  { day: 3, coins: 10, isClaimed: false },
  { day: 4, coins: 10, isClaimed: false },
  { day: 5, coins: 10, isClaimed: false },
  { day: 6, coins: 10, isClaimed: false },
  { day: 7, coins: 50, isClaimed: false, isSpecial: true },
];

export const UNLOCK_ONE_COST = 10;
export const UNLOCK_ALL_COST = 100;
