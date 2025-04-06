import { P2PKH, Transaction, Utils, PublicKey, PrivateKey } from "@bsv/sdk";
import express, { Express, Request, Response, NextFunction } from "express";
import bodyParser from "body-parser";
import prettyjson from "prettyjson";
import dotenv from "dotenv";
import { createAuthMiddleware } from "@bsv/auth-express-middleware";
import { createPaymentMiddleware } from "@bsv/payment-express-middleware";
import { getWallet } from "./utils/walletSingleton.js";
import { MongoClient } from "mongodb";
import { AdStorage, FundingRecord } from "./AdStorage.js";
import { Request as ExpressRequest } from "express";

import crypto from "crypto";

(global as any).self = { crypto };

dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI as string;
const DATABASE_NAME = process.env.DATABASE_NAME as string;
const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY as string;

const app: Express = express();
let dbClient: MongoClient;
let adStorage: AdStorage;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS Headers
app.use((req, res, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "*");
  res.header("Access-Control-Expose-Headers", "*");
  res.header("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${req.method}] <- ${req.url}`);
  console.log("Raw request body:", req.body);
  const logObject = { ...req.body };
  console.log(prettyjson.render(logObject, { keysColor: "blue" }));
  const originalJson = res.json.bind(res);
  res.json = (json: any) => {
    console.log(`[${req.method}] -> ${req.url}`);
    console.log(prettyjson.render(json, { keysColor: "green" }));
    return originalJson(json);
  };
  next();
});

const wallet = await getWallet();

const authMiddleware = createAuthMiddleware({
  wallet,
  allowUnauthenticated: false,
});

// Turn on if we can figure this part out
// const paymentMiddleware = createPaymentMiddleware({
//   wallet,
//   calculateRequestPrice: async (req) => {
//     if (!req.url.includes("/fund")) {
//       return 0;
//     }
//     const { satoshisBalance } = (req.body as any) || {};
//     try {
//       if (!satoshisBalance) return 0;
//       const amount = parseInt(satoshisBalance.toString());
//       console.log("Payment amount:", amount);
//       return amount;
//     } catch (e) {
//       console.error("Payment calculation error:", e);
//       return 0;
//     }
//   },
// });
// app.use(paymentMiddleware);
app.use(authMiddleware);

// Campaign funding route
app.post("/fund", async (req: Request, res: Response) => {
  try {
    const { campaignId, questions, answers, satoshisBalance, rewardPerAnswer } =
      req.body;
    // Can do this once the payment middleware is figured out
    // const payment = (req as any).payment;

    // if (!payment) {
    //   console.log("Payment data missing from request");
    //   return res.status(400).json({ error: "Payment data missing" });
    // }

    // console.log("Payment data:", {
    //   amount: payment.amount,
    //   txid: payment.txid,
    //   hasBeef: !!payment.beef,
    // });

    if (!campaignId) {
      return res.status(400).json({
        error: "Missing campaignId in request body",
      });
    }

    if (!questions) {
      return res.status(400).json({
        error: "Missing questions array in request body",
      });
    }

    if (!answers) {
      return res.status(400).json({
        error: "Missing answers array in request body",
      });
    }

    if (!satoshisBalance) {
      return res.status(400).json({
        error: "Missing satoshisBalance in request body",
      });
    }

    if (!rewardPerAnswer) {
      return res.status(400).json({
        error: "Missing rewardPerAnswer in request body",
      });
    }

    if (questions.length !== answers.length) {
      return res.status(400).json({
        error: `Questions and answers length mismatch. Questions: ${questions.length}, Answers: ${answers.length}`,
      });
    }

    if (isNaN(satoshisBalance)) {
      return res.status(400).json({
        error: `Invalid satoshisBalance value: ${satoshisBalance}. Must be a number.`,
      });
    }

    if (isNaN(rewardPerAnswer)) {
      return res.status(400).json({
        error: `Invalid rewardPerAnswer value: ${rewardPerAnswer}. Must be a number.`,
      });
    }

    // The payment middleware will handle the payment based on satoshisBalance in the body
    // If payment is successful, we can proceed with storing the funding record
    const fundingRecord: FundingRecord = {
      campaignId,
      questions,
      answers,
      satoshisBalance,
      rewardPerAnswer,
      txid: "", // This will be populated by the payment webhook
      createdAt: new Date(),
    };

    await adStorage.storeFunding(fundingRecord);

    res.json({
      success: true,
      message: "Campaign funded successfully",
      satoshisBalance,
      rewardPerAnswer,
    });
  } catch (error) {
    console.error("Error processing funding:", error);
    res.status(500).json({ error: "Failed to process funding" });
  }
});

// New endpoint to fetch funding records by IDs
app.post("/funding-records", async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        error: "Missing or invalid ids array in request body",
      });
    }

    const fundingRecords = await adStorage.getFundingRecordsByIds(ids);

    res.json({
      success: true,
      fundingRecords,
    });
  } catch (error) {
    console.error("Error fetching funding records:", error);
    res.status(500).json({ error: "Failed to fetch funding records" });
  }
});

// New endpoint to fetch funded ads
app.get("/funded-ads", async (req: Request, res: Response) => {
  try {
    const fundedAds = await adStorage.getFundedAds();
    res.json({
      success: true,
      ads: fundedAds,
    });
  } catch (error) {
    console.error("Error fetching funded ads:", error);
    res.status(500).json({ error: "Failed to fetch funded ads" });
  }
});

app.post("/submit-answers", async (req: Request, res: Response) => {
  try {
    const { adId, answers, publicKey } = req.body;
    if (!adId || !answers || !publicKey) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user has already submitted answers for this ad
    const hasSubmitted = await adStorage.hasSubmittedAnswers(adId, publicKey);
    if (hasSubmitted) {
      return res
        .status(400)
        .json({ error: "You have already submitted answers for this ad" });
    }

    // Get the funding record to verify answers and check balance
    const funding = await adStorage.getCampaignFunding(adId);
    if (!funding) {
      return res.status(404).json({ error: "Campaign funding not found" });
    }

    // Verify answers
    if (answers.length !== funding.answers.length) {
      return res.status(400).json({ error: "Incorrect number of answers" });
    }

    let correctAnswers = 0;
    for (let i = 0; i < answers.length; i++) {
      if (answers[i].toLowerCase() === funding.answers[i].toLowerCase()) {
        correctAnswers++;
      }
    }

    // Calculate reward using the stored rewardPerAnswer value
    const reward = correctAnswers * funding.rewardPerAnswer;
    if (reward > funding.satoshisBalance) {
      return res.status(400).json({ error: "Insufficient campaign balance" });
    }

    // Create payment transaction
    const wallet = await getWallet();
    const senderIdentityKey = PrivateKey.fromHex(SERVER_PRIVATE_KEY)
      .toPublicKey()
      .toString();

    const derivationPrefix = crypto.randomBytes(10).toString("base64");
    const derivationSuffix = crypto.randomBytes(10).toString("base64");

    const { publicKey: derivedPublicKey } = await wallet.getPublicKey({
      protocolID: [2, "3241645161d8"],
      keyID: `${derivationPrefix} ${derivationSuffix}`,
      counterparty: publicKey,
    });

    const lockingScript = new P2PKH()
      .lock(PublicKey.fromString(derivedPublicKey).toAddress())
      .toHex();

    const { tx } = await wallet.createAction({
      description: `Advertisement quiz reward for user: ${publicKey}`,
      outputs: [
        {
          satoshis: reward,
          lockingScript,
          customInstructions: JSON.stringify({
            derivationPrefix,
            derivationSuffix,
            payee: senderIdentityKey,
          }),
          outputDescription: "Advertisement quiz reward",
        },
      ],
      options: {
        randomizeOutputs: false,
      },
    });

    if (!tx) {
      throw new Error("Error creating action");
    }

    // Update campaign balance
    await adStorage.updateCampaignBalance(
      adId,
      funding.satoshisBalance - reward
    );

    // Store payout record
    const transaction = Transaction.fromBEEF(tx);
    await adStorage.storePayout({
      adId,
      publicKey,
      correctAnswers,
      reward,
      txid: transaction.id("hex"),
      createdAt: new Date(),
    });

    return res.status(200).json({
      transaction: Utils.toArray(tx, "base64"),
      derivationPrefix,
      derivationSuffix,
      amount: reward,
      senderIdentityKey,
      correctAnswers,
    });
  } catch (error) {
    console.error("Error submitting answers:", error);
    res.status(500).json({ error: "Failed to submit answers" });
  }
});

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    dbClient = new MongoClient(MONGO_URI);
    await dbClient.connect();
    console.log("Connected to MongoDB");

    const db = dbClient.db(DATABASE_NAME);
    adStorage = new AdStorage(db);
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
});
