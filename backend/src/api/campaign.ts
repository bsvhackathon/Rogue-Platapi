import { Router, Request, Response } from "express";
import { AdStorage } from "../lookup-services/AdStorage.js";
import { Campaign } from "../types.js";
import { WalletClient, CreateActionArgs, P2PKH, Transaction } from "@bsv/sdk";
import { Db } from "mongodb";

const router = Router();

// Initialize services with proper dependencies
const initializeServices = (db: Db) => {
  const walletClient = new WalletClient();
  const adStorage = new AdStorage(db);
  return { walletClient, adStorage };
};

// Create a new campaign
router.post("/campaigns", async (req: Request, res: Response) => {
  try {
    const { walletClient, adStorage } = initializeServices(req.app.locals.db);

    const {
      mediaId,
      advertiserId,
      rewardPerAnswer,
      totalFunded,
      startDate,
      endDate,
      questions,
    } = req.body;

    // Create campaign in draft status
    const campaignId = await adStorage.createCampaign({
      mediaId,
      advertiserId,
      rewardPerAnswer,
      totalFunded,
      remainingBalance: totalFunded,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: "draft",
      questions,
    });

    // Generate payment request
    const p2pkh = new P2PKH();
    const { publicKey } = await walletClient.getPublicKey({
      identityKey: true,
    });
    const lockingScript = p2pkh.lock(publicKey).toHex();

    const paymentRequestArgs: CreateActionArgs = {
      description: `Campaign funding for media ${mediaId}`,
      outputs: [
        {
          basket: "campaign_funding",
          lockingScript,
          satoshis: totalFunded,
          outputDescription: JSON.stringify({
            type: "campaign_funding",
            campaignId,
            advertiserId,
          }),
        },
      ],
    };
    const paymentRequest = await walletClient.createAction(paymentRequestArgs);

    res.json({
      campaignId,
      paymentRequest,
    });
  } catch (error) {
    console.error("Error creating campaign:", error);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// Handle payment webhook
router.post("/webhook/payment", async (req: Request, res: Response) => {
  try {
    const { walletClient, adStorage } = initializeServices(req.app.locals.db);

    const { txid, outputDescription, beef } = req.body;
    const metadata = JSON.parse(outputDescription);

    if (metadata.type === "campaign_funding") {
      const { campaignId } = metadata;

      // Get the transaction details
      const tx = Transaction.fromBEEF(beef);
      if (!tx) {
        throw new Error("Invalid transaction");
      }

      // Get the amount from the first output
      const amount = tx.outputs[0]?.satoshis ?? 0;
      if (amount === 0) {
        throw new Error("Invalid amount");
      }

      // Update campaign status to active
      await adStorage.updateCampaignBalance(campaignId, amount);

      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid webhook data" });
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

// Get advertiser's campaigns
router.get(
  "/advertisers/:advertiserId/campaigns",
  async (req: Request, res: Response) => {
    try {
      const { adStorage } = initializeServices(req.app.locals.db);
      const { advertiserId } = req.params;
      const campaigns = await adStorage.getAdvertiserCampaigns(advertiserId);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  }
);

export default router;
