export interface AppReview {
  id: string;
  name: string;
  logo: string; // Dynamic icon descriptor or emoji
  rating: number;
  downloads: string;
  apkSize: string;
  minCashout: string;
  methods: string[]; // ['JazzCash', 'EasyPaisa', etc.]
  tagline: string;
  detailedReview: string;
  detailedReviewUrdu: string;
  pros: string[];
  cons: string[];
  badge?: string; // "Editor's Choice", "Hot", "Highest Paying"
  apkUrl: string;
  dailyUsers: string;
  previewImages?: string[];
  videoUrl?: string;
}

export interface WithdrawalNotification {
  id: string;
  username: string;
  amount: number;
  method: 'JazzCash' | 'EasyPaisa' | 'Bank Transfer';
  timeAgo: string;
  gameName: string;
}

export interface AdBanner {
  id: string;
  title: string;
  subtitle: string;
  actionText: string;
  imageUrl?: string;
  badge: string;
  promoCode?: string;
}

export interface LeaderboardUser {
  rank: number;
  name: string;
  earnings: number;
  gamePlayed: string;
  avatarColor: string;
}

export interface GameStats {
  totalWins: number;
  payoutRate: string;
  activePlayers: number;
  jackpotAmount: number;
}
