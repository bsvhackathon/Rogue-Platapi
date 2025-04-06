export interface UTXOReference {
  txid: string;
  outputIndex: number;
}

// Advertiser Media
export interface AdvertiserMedia {
  id: string;
  uhrpUrl: string;
  title: string;
  description: string;
  fileType: string;
  advertiserId: string;
  createdAt: Date;
  status: "active" | "archived";
}

// Campaign
export interface Campaign {
  id: string;
  mediaId: string;
  advertiserId: string;
  rewardPerAnswer: number;
  totalFunded: number;
  remainingBalance: number;
  startDate: Date;
  endDate: Date;
  status: "draft" | "active" | "completed" | "cancelled";
  questions: Array<{
    id: string;
    text: string;
    correctAnswer: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// User View History
export interface UserViewHistory {
  id: string;
  userId: string;
  campaignId: string;
  viewedAt: Date;
  answers: Array<{
    questionId: string;
    answer: string;
    isCorrect: boolean;
    answeredAt: Date;
  }>;
  rewardsEarned: number;
  status: "pending" | "paid";
}

// Payout
export interface Payout {
  id: string;
  campaignId: string;
  userId: string;
  amount: number;
  type: "view" | "answer";
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
}
