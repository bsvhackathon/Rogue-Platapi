import { Db, Collection } from "mongodb";

export interface AdvertisementRecord {
  // On-chain data
  txid: string;
  outputIndex: number;
  title: string;
  description: string;
  fileHash: string;
  endDate: Date;
  sponsor: string;
  rewardPerAnswer: number;
  serviceUrl: string;

  // System fields
  createdAt: Date;
}

export class AdvertisementStorage {
  private collection: Collection<AdvertisementRecord>;

  constructor(db: Db) {
    this.collection = db.collection<AdvertisementRecord>("advertisements");
  }

  async storeRecord(
    txid: string,
    title: string,
    description: string,
    fileHash: string,
    endDate: Date,
    sponsor: string,
    rewardPerAnswer: number,
    serviceUrl: string
  ): Promise<void> {
    const record: AdvertisementRecord = {
      txid,
      outputIndex: 0,
      title,
      description,
      fileHash,
      endDate,
      sponsor,
      rewardPerAnswer,
      serviceUrl,
      createdAt: new Date(),
    };

    await this.collection.insertOne(record);
  }

  async findByTxid(txid: string): Promise<AdvertisementRecord | null> {
    return await this.collection.findOne({
      txid,
      endDate: { $gt: new Date() }, // Only return if not expired
    });
  }

  async findByFileHash(fileHash: string): Promise<AdvertisementRecord | null> {
    return await this.collection.findOne({
      fileHash,
      endDate: { $gt: new Date() }, // Only return if not expired
    });
  }

  async findAll(): Promise<AdvertisementRecord[]> {
    return await this.collection
      .find({
        endDate: { $gt: new Date() }, // Only return if not expired
      })
      .toArray();
  }

  async getExpiredAds(): Promise<AdvertisementRecord[]> {
    return await this.collection
      .find({
        endDate: { $lte: new Date() },
      })
      .toArray();
  }

  async findBySponsor(sponsor: string): Promise<AdvertisementRecord[]> {
    return await this.collection
      .find({
        sponsor,
        endDate: { $gt: new Date() }, // Only return if not expired
      })
      .toArray();
  }

  async findByIds(ids: string[]): Promise<AdvertisementRecord[]> {
    return await this.collection
      .find({
        txid: { $in: ids },
        endDate: { $gt: new Date() }, // Only return if not expired
      })
      .toArray();
  }

  async store(record: AdvertisementRecord): Promise<void> {
    await this.collection.insertOne({
      ...record,
      createdAt: new Date(),
    });
  }
}
