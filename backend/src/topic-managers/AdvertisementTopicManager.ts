import { AdmittanceInstructions, TopicManager } from "@bsv/overlay";
import { Transaction, Utils, PushDrop, WalletClient } from "@bsv/sdk";

const wallet = new WalletClient();

export default class AdvertisementTopicManager implements TopicManager {
  /**
   * Identify if the outputs are admissible depending on the particular protocol requirements
   * @param beef - The transaction data in BEEF format
   * @param previousCoins - The previous coins to consider
   * @returns A promise that resolves with the admittance instructions
   */
  async identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    console.log(
      "[AdvertisementTopicManager] Received new transaction in BEEF format"
    );
    console.log(
      "[AdvertisementTopicManager] Transaction size:",
      beef.length,
      "bytes"
    );

    const outputsToAdmit: number[] = [];
    try {
      const parsedTransaction = Transaction.fromBEEF(beef);
      console.log(
        "[AdvertisementTopicManager] Successfully parsed transaction"
      );
      console.log(
        "[AdvertisementTopicManager] Transaction has",
        parsedTransaction.outputs.length,
        "outputs"
      );

      // Try to decode and validate transaction outputs
      for (const [i, output] of parsedTransaction.outputs.entries()) {
        try {
          console.log(`[AdvertisementTopicManager] Processing output ${i}`);
          console.log(
            `[AdvertisementTopicManager] Output script: ${output.lockingScript.toHex()}`
          );

          // Check if this looks like a PushDrop token
          const scriptHex = output.lockingScript.toHex();
          if (!scriptHex.startsWith("21")) {
            // PushDrop tokens start with OP_PUSHBYTES_33
            console.log(
              `[AdvertisementTopicManager] Output ${i} is not a PushDrop token, skipping`
            );
            continue;
          }

          // Parse PushDrop locking script
          const decoded = PushDrop.decode(output.lockingScript);
          console.log(
            "[AdvertisementTopicManager] Successfully decoded PushDrop token"
          );

          // Verify the token contains the required fields
          if (!decoded || !decoded.fields || decoded.fields.length < 4) {
            console.error(
              "[AdvertisementTopicManager] Invalid PushDrop token structure. Expected 4 fields, got:",
              decoded?.fields?.length || 0
            );
            throw new Error("Invalid PushDrop token structure");
          }

          // Verify the protocol address matches
          const protocolAddr = Utils.toUTF8(decoded.fields[0]);
          console.log(
            "[AdvertisementTopicManager] Protocol address:",
            protocolAddr
          );

          if (protocolAddr !== "1AdDtKreEzbHYKFjmoBuduFmSXXUGZG") {
            console.error(
              "[AdvertisementTopicManager] Invalid protocol address. Expected: 1AdDtKreEzbHYKFjmoBuduFmSXXUGZG, Got:",
              protocolAddr
            );
            throw new Error("Invalid protocol address");
          }

          outputsToAdmit.push(i);
        } catch (error) {
          console.error(
            `[AdvertisementTopicManager] Error processing output ${i}:`,
            error
          );
          // Continue processing other outputs
          continue;
        }
      }
      if (outputsToAdmit.length === 0) {
        console.warn("[AdvertisementTopicManager] No outputs admitted!");
      }
      console.log(
        "[AdvertisementTopicManager] Admitted",
        outputsToAdmit.length,
        "outputs"
      );
      return {
        outputsToAdmit,
        coinsToRetain: [],
      };
    } catch (error) {
      console.error(
        "[AdvertisementTopicManager] Error processing transaction:",
        error
      );
      return {
        outputsToAdmit: [],
        coinsToRetain: [],
      };
    }
  }

  /**
   * Get the documentation associated with this topic manager
   * @returns A promise that resolves to a string containing the documentation
   */
  async getDocumentation(): Promise<string> {
    return "Advertisement Topic Manager Documentation";
  }

  /**
   * Get metadata about the topic manager
   * @returns A promise that resolves to an object containing metadata
   */
  async getMetaData(): Promise<{
    name: string;
    shortDescription: string;
    iconURL?: string;
    version?: string;
    informationURL?: string;
  }> {
    return {
      name: "Advertisement Topic Manager",
      shortDescription: "Topic manager for advertisement content",
    };
  }
}
