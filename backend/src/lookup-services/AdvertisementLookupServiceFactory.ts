import {
  LookupService,
  LookupQuestion,
  LookupAnswer,
  LookupFormula,
} from "@bsv/overlay";
import { AdvertisementStorage } from "./AdvertisementStorage.js";
import { Script, Utils, PushDrop } from "@bsv/sdk";
import { Db } from "mongodb";
// import docs from "./AdvertisementLookupDocs.md.js";

/**
 * Implements an Advertisement lookup service
 *
 * Note: Uses PushDrop to decode advertisement tokens.
 *
 * @public
 */
class AdvertisementLookupService implements LookupService {
  /**
   * Constructs a new AdvertisementLookupService instance
   * @param storage - The storage instance to use for managing records
   */
  constructor(public storage: AdvertisementStorage) {
    console.log("[AdvertisementLookupService] Initialized with storage");
  }

  /**
   * Notifies the lookup service of a new output added.
   *
   * @param {string} txid - The transaction ID containing the output.
   * @param {number} outputIndex - The index of the output in the transaction.
   * @param {Script} outputScript - The script of the output to be processed.
   * @param {string} topic - The topic associated with the output.
   *
   * @returns {Promise<void>} A promise that resolves when the processing is complete.
   * @throws Will throw an error if there is an issue with storing the record in the storage engine.
   */
  async outputAdded?(
    txid: string,
    outputIndex: number,
    outputScript: Script,
    topic: string
  ): Promise<void> {
    console.log(
      `[AdvertisementLookupService] New output added - txid: ${txid}, outputIndex: ${outputIndex}, topic: ${topic}`
    );

    if (topic !== "tm_advertisement") {
      console.log(
        `[AdvertisementLookupService] Skipping output - wrong topic: ${topic}`
      );
      return;
    }

    try {
      console.log(
        "[AdvertisementLookupService] Attempting to decode PushDrop token"
      );
      // Decode the PushDrop token fields from the Bitcoin outputScript
      const decoded = PushDrop.decode(outputScript);
      if (!decoded || !decoded.fields || decoded.fields.length < 4) {
        console.error(
          "[AdvertisementLookupService] Invalid PushDrop token structure"
        );
        throw new Error("Invalid PushDrop token structure");
      }

      console.log(
        "[AdvertisementLookupService] Successfully decoded PushDrop token"
      );
      // Log raw fields for debugging
      console.log("[AdvertisementLookupService] Raw fields:", {
        hex: decoded.fields.map((f) => Utils.toHex(f)),
        utf8: decoded.fields.map((f) => Utils.toUTF8(f)),
        raw: decoded.fields,
      });

      // Parse out the fields
      const title = Utils.toUTF8(decoded.fields[1]);
      const description = Utils.toUTF8(decoded.fields[2]);
      const fileHash = Utils.toUTF8(decoded.fields[3]);
      const endDate = new Date(Utils.toUTF8(decoded.fields[4]));
      const sponsor = Utils.toUTF8(decoded.fields[5]);
      const rewardPerAnswer = parseInt(Utils.toUTF8(decoded.fields[6]));
      const serviceUrl = Utils.toUTF8(decoded.fields[7]);

      console.log("[AdvertisementLookupService] Parsed fields:", {
        title,
        description,
        fileHash,
        endDate: endDate.toISOString(),
        sponsor,
        rewardPerAnswer,
        serviceUrl,
      });

      // Store the token fields for future lookup
      console.log("[AdvertisementLookupService] Storing record in database");
      await this.storage.storeRecord(
        txid,
        title,
        description,
        fileHash,
        endDate,
        sponsor,
        rewardPerAnswer,
        serviceUrl
      );
      console.log("[AdvertisementLookupService] Successfully stored record");
    } catch (e) {
      console.error(
        "[AdvertisementLookupService] Error indexing token in lookup database:",
        e
      );
      return;
    }
  }

  /**
   * Notifies the lookup service that an output was spent
   * @param txid - The transaction ID of the spent output
   * @param outputIndex - The index of the spent output
   * @param topic - The topic associated with the spent output
   */
  async outputSpent?(
    txid: string,
    outputIndex: number,
    topic: string
  ): Promise<void> {
    console.log(
      `[AdvertisementLookupService] Output spent - txid: ${txid}, outputIndex: ${outputIndex}, topic: ${topic}`
    );
    if (topic !== "tm_advertisement") {
      console.log(
        `[AdvertisementLookupService] Skipping output - wrong topic: ${topic}`
      );
      return;
    }
    // We don't delete records when outputs are spent, as the endDate determines validity
    console.log(
      "[AdvertisementLookupService] Output spent - no action taken (validity determined by endDate)"
    );
  }

  /**
   * Notifies the lookup service that an output has been deleted
   * @param txid - The transaction ID of the deleted output
   * @param outputIndex - The index of the deleted output
   * @param topic - The topic associated with the deleted output
   */
  async outputDeleted?(
    txid: string,
    outputIndex: number,
    topic: string
  ): Promise<void> {
    console.log(
      `[AdvertisementLookupService] Output deleted - txid: ${txid}, outputIndex: ${outputIndex}, topic: ${topic}`
    );
    if (topic !== "tm_advertisement") {
      console.log(
        `[AdvertisementLookupService] Skipping output - wrong topic: ${topic}`
      );
      return;
    }
    // We don't delete records when outputs are deleted, as the endDate determines validity
    console.log(
      "[AdvertisementLookupService] Output deleted - no action taken (validity determined by endDate)"
    );
  }

  /**
   * Answers a lookup query
   * @param question - The lookup question to be answered
   * @returns A promise that resolves to a lookup answer or formula
   */
  async lookup(
    question: LookupQuestion
  ): Promise<LookupAnswer | LookupFormula> {
    console.log(
      "[AdvertisementLookupService] Received lookup query:",
      JSON.stringify(question, null, 2)
    );

    if (question.query === undefined || question.query === null) {
      console.error(
        "[AdvertisementLookupService] Invalid query - no query provided"
      );
      throw new Error("A valid query must be provided!");
    }
    if (question.service !== "ls_advertisement") {
      console.error(
        `[AdvertisementLookupService] Invalid service - expected ls_advertisement, got ${question.service}`
      );
      throw new Error("Lookup service not supported!");
    }

    const query = question.query as {
      publicKey?: string;
      ids?: string[];
      findAll?: boolean;
    };

    console.log("[AdvertisementLookupService] Processing query:", query);

    if (query.findAll) {
      console.log("[AdvertisementLookupService] Finding all advertisements");
      const ads = await this.storage.findAll();
      console.log(
        `[AdvertisementLookupService] Found ${ads.length} advertisements`
      );
      return {
        type: "output-list",
        outputs: ads.map((ad) => ({
          txid: ad.txid,
          outputIndex: ad.outputIndex,
          beef: Utils.toArray(ad.txid, "hex"),
        })),
      };
    }

    if (query.ids) {
      console.log(
        "[AdvertisementLookupService] Finding advertisements by IDs:",
        query.ids
      );
      const ads = await this.storage.findByIds(query.ids);
      console.log(
        `[AdvertisementLookupService] Found ${ads.length} advertisements by IDs`
      );
      return ads.map((ad) => ({
        outputIndex: ad.outputIndex,
        txid: ad.txid,
      }));
    }

    if (!query.publicKey) {
      console.error("[AdvertisementLookupService] No public key provided");
      throw new Error("Public key is required for advertisement lookup");
    }

    console.log(
      `[AdvertisementLookupService] Finding advertisements for public key: ${query.publicKey}`
    );

    const ads = await this.storage.findBySponsor(query.publicKey);

    console.log(
      `[AdvertisementLookupService] Found ${ads.length} advertisements for public key`,
      { ads }
    );

    return ads.map((ad) => ({
      outputIndex: ad.outputIndex,
      txid: ad.txid,
    }));
  }

  /**
   * Returns documentation specific to this overlay lookup service
   * @returns A promise that resolves to the documentation string
   */
  async getDocumentation(): Promise<string> {
    console.log("[AdvertisementLookupService] Returning documentation");
    return "Advertisement Lookup Service Documentation";
  }

  /**
   * Returns metadata associated with this lookup service
   * @returns A promise that resolves to an object containing metadata
   */
  async getMetaData(): Promise<{
    name: string;
    shortDescription: string;
    iconURL?: string;
    version?: string;
    informationURL?: string;
  }> {
    console.log("[AdvertisementLookupService] Returning metadata");
    return {
      name: "Advertisement Lookup Service",
      shortDescription: "Lookup service for advertisement content",
    };
  }
}

// Factory function
export default (db: Db): LookupService => {
  console.log(
    "[AdvertisementLookupService] Creating new lookup service instance"
  );
  return new AdvertisementLookupService(new AdvertisementStorage(db));
};
