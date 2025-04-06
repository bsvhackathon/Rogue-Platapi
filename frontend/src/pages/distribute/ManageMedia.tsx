import React, { useEffect, useCallback, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Grid,
  IconButton,
  CircularProgress,
  Chip,
  Divider,
  Tooltip,
  useTheme,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton as MuiIconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  LookupResolver,
  WalletClient,
  Transaction,
  Utils,
  PushDrop,
  AuthFetch,
} from "@bsv/sdk";

const wallet = new WalletClient("auto", "localhost");
const authFetch = new AuthFetch(wallet);

interface AdvertisementData {
  title: string;
  description: string;
  fileHash: string;
  endDate: Date;
  sponsor: string;
  rewardPerAnswer: number;
  serviceUrl: string;
  id: string;
}

interface LookupOutput {
  beef: number[];
  outputIndex: number;
  txid: string;
}

interface LookupResult {
  type: string;
  outputs: LookupOutput[];
}

interface QAPair {
  question: string;
  answer: string;
}

interface FundingModalProps {
  open: boolean;
  onClose: () => void;
  onFund: (satoshis: number, qaPairs: QAPair[]) => void;
  rewardPerAnswer: number;
}

interface FundingRecord {
  campaignId: string;
  satoshisBalance: number;
  createdAt: string;
}

const FundingModal: React.FC<FundingModalProps> = ({
  open,
  onClose,
  onFund,
  rewardPerAnswer,
}) => {
  const [numberOfViews, setNumberOfViews] = useState<string>("");
  const [qaPairs, setQAPairs] = useState<QAPair[]>([
    { question: "", answer: "" },
  ]);

  const handleAddQAPair = () => {
    setQAPairs([...qaPairs, { question: "", answer: "" }]);
  };

  const handleRemoveQAPair = (index: number) => {
    const newPairs = qaPairs.filter((_, i) => i !== index);
    setQAPairs(newPairs);
  };

  const handleUpdateQAPair = (
    index: number,
    field: keyof QAPair,
    value: string
  ) => {
    const newPairs = [...qaPairs];
    newPairs[index] = { ...newPairs[index], [field]: value };
    setQAPairs(newPairs);
  };

  const handleFund = () => {
    const viewsNum = parseInt(numberOfViews);
    if (isNaN(viewsNum) || viewsNum <= 0) {
      alert("Please enter a valid number of views");
      return;
    }
    if (qaPairs.some((pair) => !pair.question || !pair.answer)) {
      alert("Please fill in all questions and answers");
      return;
    }

    // Calculate total satoshis: views * questions * reward per answer
    const totalSatoshis = viewsNum * qaPairs.length * rewardPerAnswer;
    onFund(totalSatoshis, qaPairs);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Fund Campaign</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Number of views"
            type="number"
            value={numberOfViews}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNumberOfViews(e.target.value)
            }
            sx={{ mb: 3 }}
            helperText={`Total cost: ${
              numberOfViews
                ? parseInt(numberOfViews) * qaPairs.length * rewardPerAnswer
                : 0
            } satoshis (${numberOfViews} views × ${
              qaPairs.length
            } questions × ${rewardPerAnswer} sat/answer)`}
          />

          <Typography variant="subtitle1" gutterBottom>
            Questions & Answers
          </Typography>

          {qaPairs.map((pair, index) => (
            <Box key={index} sx={{ display: "flex", gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                label="Question"
                value={pair.question}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleUpdateQAPair(index, "question", e.target.value)
                }
              />
              <TextField
                fullWidth
                label="Answer"
                value={pair.answer}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleUpdateQAPair(index, "answer", e.target.value)
                }
              />
              <MuiIconButton
                onClick={() => handleRemoveQAPair(index)}
                disabled={qaPairs.length === 1}
                sx={{ alignSelf: "center" }}
              >
                <RemoveIcon />
              </MuiIconButton>
            </Box>
          ))}

          <Button
            startIcon={<AddIcon />}
            onClick={handleAddQAPair}
            sx={{ mt: 1 }}
          >
            Add Question & Answer
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleFund} variant="contained" color="primary">
          Fund Campaign
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ManageMedia: React.FC = () => {
  const theme = useTheme();
  const [advertisements, setAdvertisements] = useState<AdvertisementData[]>([]);
  const [advertisementsLoading, setAdvertisementsLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<AdvertisementData | null>(null);
  const [fundingModalOpen, setFundingModalOpen] = useState(false);
  const [fundingRecords, setFundingRecords] = useState<
    Record<string, FundingRecord[]>
  >({});

  const fetchFundingRecords = async (adIds: string[]) => {
    try {
      const publicKey = await wallet.getPublicKey({ identityKey: true });
      const response = await authFetch.fetch(
        "http://localhost:3000/funding-records",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: adIds, publicKey: publicKey.publicKey }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch funding records");
      }

      const { fundingRecords: records } = await response.json();

      // Group funding records by campaignId
      const groupedRecords = records.reduce(
        (acc: Record<string, FundingRecord[]>, record: FundingRecord) => {
          if (!acc[record.campaignId]) {
            acc[record.campaignId] = [];
          }
          acc[record.campaignId].push(record);
          return acc;
        },
        {}
      );

      setFundingRecords(groupedRecords);
    } catch (error) {
      console.error("Error fetching funding records:", error);
    }
  };

  const fetchAdvertisements = useCallback(async () => {
    try {
      const resolver = new LookupResolver({ networkPreset: "local" });
      const identityKey = await wallet.getPublicKey({
        identityKey: true,
      });
      const publicKey = identityKey.publicKey;

      const lookupResult = (await resolver.query({
        service: "ls_advertisement",
        query: { publicKey },
      })) as LookupResult;

      console.log("Raw lookup result:", JSON.stringify(lookupResult, null, 2));

      if (!lookupResult || lookupResult.type !== "output-list") {
        throw new Error("Invalid lookup result format");
      }

      const parsedAds: AdvertisementData[] = [];

      for (const output of lookupResult.outputs) {
        try {
          console.log("Processing output:", output);

          console.log("Converting BEEF to Transaction...");
          const tx = Transaction.fromBEEF(output.beef);
          console.log("Transaction created successfully");

          console.log(
            "Getting locking script for output index:",
            output.outputIndex
          );
          const script = tx.outputs[output.outputIndex].lockingScript.toHex();
          console.log("Locking script hex:", script);

          console.log("Decoding PushDrop token...");
          const decoded = PushDrop.decode(
            tx.outputs[output.outputIndex].lockingScript
          );
          console.log(
            "Decoded PushDrop token fields:",
            decoded.fields.map((f) => Buffer.from(f).toString("hex"))
          );

          const txid = tx.id("hex");

          if (!decoded || !decoded.fields || decoded.fields.length < 8) {
            console.error("Invalid PushDrop token structure:", {
              hasDecoded: !!decoded,
              hasFields: !!decoded?.fields,
              fieldsLength: decoded?.fields?.length,
            });
            continue;
          }

          console.log("Decoding fields...");
          const ad: AdvertisementData = {
            title: Utils.toUTF8(decoded.fields[1]),
            description: Utils.toUTF8(decoded.fields[2]),
            fileHash: Utils.toUTF8(decoded.fields[3]),
            endDate: new Date(Utils.toUTF8(decoded.fields[4])),
            sponsor: Utils.toUTF8(decoded.fields[5]),
            rewardPerAnswer: parseInt(Utils.toUTF8(decoded.fields[6])),
            serviceUrl: Utils.toUTF8(decoded.fields[7]),
            id: txid,
          };
          console.log("Decoded advertisement data:", ad);

          parsedAds.push(ad);
          console.log("Successfully added advertisement to list");
        } catch (error: any) {
          console.error("Failed to parse advertisement:", error);
          console.error("Error details:", {
            message: error.message,
            stack: error.stack,
            output: output,
          });
        }
      }

      console.log("Final parsed advertisements:", parsedAds);
      setAdvertisements(parsedAds);

      // Fetch funding records for all advertisements
      if (parsedAds.length > 0) {
        await fetchFundingRecords(parsedAds.map((ad) => ad.id));
      }
    } catch (error) {
      console.error("Failed to load Advertisements:", error);
    } finally {
      setAdvertisementsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdvertisements();
  }, [fetchAdvertisements]);

  const handleFundCampaign = async (satoshis: number, qaPairs: QAPair[]) => {
    try {
      if (!selectedAd) return;

      // Prepare the funding request data
      const questions = qaPairs.map((pair) => pair.question);
      const answers = qaPairs.map((pair) => pair.answer);

      console.log("Sending funding request:", {
        campaignId: selectedAd.id,
        satoshis,
        questions,
        answers,
        rewardPerAnswer: selectedAd.rewardPerAnswer,
      });

      const publicKey = await wallet.getPublicKey({ identityKey: true });

      // Send the funding request to the server using AuthFetch
      const response = await authFetch.fetch("http://localhost:3000/fund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId: selectedAd.id,
          questions,
          answers,
          satoshisBalance: satoshis,
          rewardPerAnswer: selectedAd.rewardPerAnswer,
          publicKey: publicKey.publicKey,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Funding request failed:", errorText);
        throw new Error(`Failed to process funding: ${errorText}`);
      }

      const result = await response.json();
      console.log("Funding successful:", result);
      setFundingModalOpen(false);

      // Refresh both advertisements and funding records
      await fetchAdvertisements();
    } catch (error) {
      console.error("Error funding campaign:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to fund campaign. Please try again."
      );
    }
  };

  if (advertisementsLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 1200, margin: "0 auto" }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: "bold" }}>
        Manage Your Media
      </Typography>

      {advertisements.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No advertisements found
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {advertisements.map((ad, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.2s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: theme.shadows[8],
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ fontWeight: "bold" }}
                  >
                    {ad.title}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 2,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {ad.description}
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Box
                    sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}
                  >
                    <Chip
                      icon={<QuestionAnswerIcon />}
                      label={`${ad.rewardPerAnswer} sat/a`}
                      color="secondary"
                      variant="outlined"
                      size="small"
                    />
                    <Chip
                      icon={<AccessTimeIcon />}
                      label={ad.endDate.toLocaleDateString()}
                      color="default"
                      variant="outlined"
                      size="small"
                    />
                  </Box>

                  {/* Funding Records Section */}
                  {fundingRecords[ad.id] &&
                    fundingRecords[ad.id].length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Accordion
                          sx={{
                            bgcolor: "background.paper",
                            boxShadow: "none",
                            "&:before": {
                              display: "none",
                            },
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{
                              minHeight: "48px",
                              "& .MuiAccordionSummary-content": {
                                margin: "8px 0",
                              },
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Typography
                                variant="subtitle2"
                                color="text.secondary"
                              >
                                Funding History
                              </Typography>
                              <Chip
                                label={`Total: ${fundingRecords[ad.id].reduce(
                                  (sum, record) => sum + record.satoshisBalance,
                                  0
                                )} sats`}
                                color="success"
                                size="small"
                              />
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails sx={{ pt: 0 }}>
                            {fundingRecords[ad.id].map((record, idx) => (
                              <Box
                                key={idx}
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  mb: 1,
                                  p: 1,
                                  bgcolor: "background.default",
                                  borderRadius: 1,
                                }}
                              >
                                <Typography variant="body2">
                                  {new Date(
                                    record.createdAt
                                  ).toLocaleDateString()}
                                </Typography>
                                <Chip
                                  label={`${record.satoshisBalance} sats`}
                                  color="success"
                                  size="small"
                                />
                              </Box>
                            ))}
                          </AccordionDetails>
                        </Accordion>
                      </Box>
                    )}

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block" }}
                  >
                    File Hash: {ad.fileHash.substring(0, 8)}...
                  </Typography>
                </CardContent>

                <CardActions sx={{ justifyContent: "flex-end", p: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                      setSelectedAd(ad);
                      setFundingModalOpen(true);
                    }}
                    disabled={
                      fundingRecords[ad.id] && fundingRecords[ad.id].length > 0
                    }
                  >
                    {fundingRecords[ad.id] && fundingRecords[ad.id].length > 0
                      ? "Already Funded"
                      : "Fund Campaign"}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <FundingModal
        open={fundingModalOpen}
        onClose={() => setFundingModalOpen(false)}
        onFund={handleFundCampaign}
        rewardPerAnswer={selectedAd?.rewardPerAnswer || 0}
      />
    </Box>
  );
};

export default ManageMedia;
