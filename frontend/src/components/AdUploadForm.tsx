import React, { useState, type FormEvent } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Slider,
  Paper,
  LinearProgress,
} from "@mui/material";
import { toast } from "react-toastify";
import {
  StorageUploader,
  WalletClient,
  Transaction,
  Utils,
  Script,
  PushDrop,
  SHIPBroadcasterConfig,
  SHIPBroadcaster,
} from "@bsv/sdk";
import type { CreateActionArgs } from "@babbage/sdk-ts/out/src/sdk";
import styled from "@emotion/styled";

// This is the namespace address for the Advertisement protocol
const AD_PROTO_ADDR = "1AdDtKreEzbHYKFjmoBuduFmSXXUGZG";

export interface AdUploadData {
  title: string;
  description: string;
  videoFile: File;
  retentionPeriod: number; // in days
  rewardPerAnswer: number;
  uhrpUrl?: string;
  txid?: string;
}

interface AdUploadFormProps {
  onSubmit: (adData: AdUploadData) => Promise<void>;
}

const LoadingBar = styled(LinearProgress)({
  margin: "1em",
});

export const AdUploadForm: React.FC<AdUploadFormProps> = ({ onSubmit }) => {
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [retentionPeriod, setRetentionPeriod] = useState<number>(30); // default 30 days
  const [rewardPerAnswer, setRewardPerAnswer] = useState<number>(10); // default 10 satoshis per answer
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setVideoFile(null);
    setRetentionPeriod(30);
    setRewardPerAnswer(10);
    setPreviewUrl(null);
    // Reset file input
    const fileInput = document.getElementById(
      "video-upload"
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!videoFile) {
      toast.error("Please select a video file");
      return;
    }

    setIsUploading(true);
    try {
      // Upload to UHRP
      const uploader = new StorageUploader({
        storageURL: "https://nanostore.babbage.systems",
        wallet: new WalletClient(),
      });

      const fileData = await videoFile.arrayBuffer();
      const uint8Array = new Uint8Array(fileData);
      const numberArray = Array.from(uint8Array);

      const result = await uploader.publishFile({
        file: {
          data: numberArray,
          type: videoFile.type,
        },
        retentionPeriod: retentionPeriod * 24 * 60,
      });

      // Create advertisement token using PushDrop
      const wallet = new WalletClient();
      const pushdrop = new PushDrop(wallet);

      const identityKey = await wallet.getPublicKey({
        identityKey: true,
      });

      console.log("identityKey:", identityKey.publicKey);

      const bitcoinOutputScript = await pushdrop.lock(
        [
          Utils.toArray(AD_PROTO_ADDR, "utf8") as number[],
          Utils.toArray(title, "utf8") as number[],
          Utils.toArray(description, "utf8") as number[],
          Utils.toArray(result.uhrpURL, "utf8") as number[],
          // convert the retention period, which is in days to a specific date for when this ad expires
          Utils.toArray(
            new Date(
              Date.now() + retentionPeriod * 24 * 60 * 60 * 1000
            ).toISOString(),
            "utf8"
          ) as number[],
          // Sponsor public key, which is the person doing this action
          Utils.toArray(identityKey.publicKey, "utf8") as number[],
          // Reward amount
          Utils.toArray(rewardPerAnswer.toString(), "utf8") as number[],
          Utils.toArray(window.location.hostname, "utf8") as number[],
        ],
        [0, "advertisement"],
        "1",
        "self"
      );

      const newAdToken = await wallet.createAction({
        description: "Create advertisement",
        outputs: [
          {
            basket: "advertisement tokens",
            lockingScript: bitcoinOutputScript.toHex(),
            satoshis: 1000,
            outputDescription: "Advertisement output",
          },
        ],
        options: { randomizeOutputs: false },
      });

      if (!newAdToken.tx) {
        throw new Error("Transaction is undefined");
      }

      const transaction = Transaction.fromAtomicBEEF(newAdToken.tx);
      const txid = transaction.id("hex");

      const args: SHIPBroadcasterConfig = {
        networkPreset: location.hostname === 'localhost' ? 'local' : 'mainnet',
      };
      const broadcaster = new SHIPBroadcaster(["tm_advertisement"], args);
      const broadcasterResult = await broadcaster.broadcast(transaction);
      console.log("broadcasterResult:", broadcasterResult);
      if (broadcasterResult.status === "error") {
        console.error(
          "AdUploadForm: Transaction failed to broadcast",
          broadcasterResult
        );
        throw new Error("AdUploadForm: Transaction failed to broadcast");
      }

      // Submit form with UHRP URL and transaction data
      await onSubmit({
        title,
        description,
        videoFile,
        retentionPeriod,
        rewardPerAnswer,
        uhrpUrl: result.uhrpURL,
        txid,
      });

      toast.success("Advertisement uploaded successfully!");
      resetForm(); // Clear the form after successful upload
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload advertisement. Please try again.");
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 600, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Upload New Ad Campaign
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
        <TextField
          fullWidth
          label="Ad Title"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setTitle(e.target.value);
          }}
          margin="normal"
          required
          disabled={isUploading}
        />

        <TextField
          fullWidth
          label="Description"
          value={description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setDescription(e.target.value);
          }}
          margin="normal"
          multiline
          rows={3}
          disabled={isUploading}
        />

        <Box sx={{ my: 2 }}>
          <Typography gutterBottom>Video File</Typography>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
            id="video-upload"
            disabled={isUploading}
          />
          <label htmlFor="video-upload">
            <Button variant="contained" component="span" disabled={isUploading}>
              Select Video
            </Button>
          </label>
          {videoFile && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Selected: {videoFile.name}
            </Typography>
          )}
        </Box>

        {previewUrl && (
          <Box sx={{ my: 2 }}>
            <Typography gutterBottom>Preview</Typography>
            <video
              controls
              width="100%"
              src={previewUrl}
              style={{ maxHeight: "300px" }}
            />
          </Box>
        )}

        <Box sx={{ my: 2 }}>
          <Typography gutterBottom>
            Storage Duration: {retentionPeriod} days
          </Typography>
          <Slider
            value={retentionPeriod}
            onChange={(_: unknown, value: number) => {
              setRetentionPeriod(value);
            }}
            min={1}
            max={365}
            step={1}
            marks
            disabled={isUploading}
          />
        </Box>

        <Box sx={{ my: 2 }}>
          <TextField
            fullWidth
            type="number"
            label="Reward per Answer (satoshis)"
            value={rewardPerAnswer}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setRewardPerAnswer(parseInt(e.target.value) || 0);
            }}
            margin="normal"
            required
            disabled={isUploading}
            inputProps={{ min: 1 }}
          />
        </Box>

        {isUploading && <LoadingBar />}

        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={!videoFile || isUploading}
        >
          {isUploading ? "Uploading..." : "Upload Campaign"}
        </Button>
      </Box>
    </Paper>
  );
};
