import { Collection, Db, DeleteResult } from 'mongodb';
import { KeyRecord, BalanceRecord } from './types.js';
import dotenv from 'dotenv'

dotenv.config()

const KEY_COLLECTION_NAME = process.env.KEY_COLLECTION_NAME as string
const BALANCE_COLLECTION_NAME = process.env.BALANCE_COLLECTION_NAME as string

export class KeyStorage {
  private readonly records: Collection<KeyRecord>
  private readonly balances: Collection<BalanceRecord>

  /**
   * Constructs a new KeyStorage instance
   * @param {Db} db - connected mongo database instance
   */
  constructor(private readonly db: Db) {
    this.records = db.collection<KeyRecord>(KEY_COLLECTION_NAME)
    this.balances = db.collection<BalanceRecord>(BALANCE_COLLECTION_NAME)
  }

  /**
   * Stores a record in the database
   * @param {string} fileUrl The file url
   * @param {string} encryptionKey The encryption key
   * @param {number} satoshis The satoshi count
   * @param {string} publicKey The public key of the uploader
   */
  async storeRecord(
    fileUrl: string,
    encryptionKey: string,
    satoshis: number,
    publicKey: string
  ): Promise<void> {
    console.log('Storing record in MongoDB:', {
      fileUrl,
      encryptionKey,
      satoshis,
      publicKey
    });

    try {
      await this.records.insertOne({
        fileUrl,
        encryptionKey,
        satoshis,
        publicKey
      });
    } catch (error) {
      console.error('Failed to store record:', error);
      throw error;
    }
  }

  /**
 * Delete a matching record
 * @param {string} fileUrl The file url
 */
  async deleteRecord(fileUrl: string): Promise<void> {
    await this.records.deleteOne({ fileUrl })
  }

  /**
   * Finds all records (for testing purposes)
   * @returns {Promise<KeyRecord[]>} All stored records
   */
  async findAll(): Promise<KeyRecord[]> {
    try {
      return await this.records.find({}).toArray();
    } catch (error) {
      console.error('Failed to retrieve all records:', error);
      throw error;
    }
  }

  /**
   * Finds records by query using fileUrl
   * @param {string} fileUrl The file url
   * @returns {Promise<KeyRecord[]>} Matching records
   */
  async findByQuery(
    fileUrl: string
  ): Promise<KeyRecord[]> {
    try {
      return await this.records
        .find({ fileUrl })
        .toArray();
    } catch (error) {
      console.error('Failed to find records by query:', error);
      throw error;
    }
  }

  /**
 * Increments the given publicKey's balance by `amount`.
 * If no entry exists, creates one with the initial balance = amount.
 */
  async incrementBalance(publicKey: string, amount: number): Promise<void> {
    if (amount <= 0) return

    await this.balances.updateOne(
      { publicKey },
      { $inc: { balance: amount } },
      { upsert: true }
    )
  }

  /**
   * Returns the current balance for a given publicKey (or 0 if none found).
   */
  async getBalance(publicKey: string): Promise<number> {
    const doc = await this.balances.findOne({ publicKey })
    return doc?.balance || 0
  }

  /**
   * Sets the publicKey's balance to a new value (e.g., after a withdrawal).
   */
  async setBalance(publicKey: string, newBalance: number): Promise<void> {
    await this.balances.updateOne(
      { publicKey },
      { $set: { balance: newBalance } },
      { upsert: true }
    )
  }
}
