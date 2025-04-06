import { Collection, Db } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const FUNDING_COLLECTION_NAME =
  process.env.FUNDING_COLLECTION_NAME || "funding";
const PAYOUT_COLLECTION_NAME = process.env.PAYOUT_COLLECTION_NAME || "payouts";

export interface FundingRecord {
  campaignId: string;
  questions: string[];
  answers: string[];
  satoshisBalance: number;
  rewardPerAnswer: number;
  txid: string;
  createdAt: Date;
}

export interface PayoutRecord {
  adId: string;
  publicKey: string;
  correctAnswers: number;
  reward: number;
  txid: string;
  createdAt: Date;
}

export class AdStorage {
  private readonly funding: Collection<FundingRecord>;
  private readonly payouts: Collection<PayoutRecord>;

  constructor(private readonly db: Db) {
    this.funding = db.collection<FundingRecord>(FUNDING_COLLECTION_NAME);
    this.payouts = db.collection<PayoutRecord>(PAYOUT_COLLECTION_NAME);
  }

  async storeFunding(funding: FundingRecord): Promise<void> {
    try {
      await this.funding.insertOne(funding);
    } catch (error) {
      console.error("Failed to store funding:", error);
      throw error;
    }
  }

  async getCampaignFunding(campaignId: string): Promise<FundingRecord | null> {
    try {
      return await this.funding.findOne({ campaignId });
    } catch (error) {
      console.error("Failed to get campaign funding:", error);
      throw error;
    }
  }

  async getCampaignFundings(): Promise<FundingRecord[]> {
    try {
      return await this.funding.find().sort({ createdAt: -1 }).toArray();
    } catch (error) {
      console.error("Failed to get campaign fundings:", error);
      throw error;
    }
  }

  async getFundingRecordsByIds(ids: string[]): Promise<FundingRecord[]> {
    try {
      return await this.funding.find({ campaignId: { $in: ids } }).toArray();
    } catch (error) {
      console.error("Failed to get funding records by IDs:", error);
      throw error;
    }
  }

  async getFundedAds(): Promise<string[]> {
    try {
      const fundingRecords = await this.funding.find({}).toArray();
      const uniqueCampaignIds = [
        ...new Set(fundingRecords.map((record) => record.campaignId)),
      ];
      return uniqueCampaignIds;
    } catch (error) {
      console.error("Error fetching funded ads:", error);
      throw error;
    }
  }

  async updateCampaignBalance(
    campaignId: string,
    newBalance: number
  ): Promise<void> {
    try {
      await this.funding.updateOne(
        { campaignId },
        { $set: { satoshisBalance: newBalance } }
      );
    } catch (error) {
      console.error("Failed to update campaign balance:", error);
      throw error;
    }
  }

  async storePayout(payout: PayoutRecord): Promise<void> {
    try {
      await this.payouts.insertOne(payout);
    } catch (error) {
      console.error("Failed to store payout:", error);
      throw error;
    }
  }

  async hasSubmittedAnswers(adId: string, publicKey: string): Promise<boolean> {
    try {
      const existingPayout = await this.payouts.findOne({ adId, publicKey });
      console.log("existingPayout", existingPayout);
      return !!existingPayout;
    } catch (error) {
      console.error("Failed to check for existing payout:", error);
      throw error;
    }
  }
}
