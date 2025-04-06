import React, { useEffect, useState, useRef } from "react";
import {
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Fade,
  Slide,
} from "@mui/material";
import {
  LookupResolver,
  Transaction,
  PushDrop,
  Utils,
  AuthFetch,
  WalletClient,
} from "@bsv/sdk";
import { Source } from "@bsv/uhrp-react";
import CloseIcon from "@mui/icons-material/Close";

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

interface QuestionAnswer {
  question: string;
  answer: string;
}

const Watch: React.FC = () => {
  const [advertisements, setAdvertisements] = useState<AdvertisementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<AdvertisementData | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions, setQuestions] = useState<QuestionAnswer[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const wallet = new WalletClient("auto", "localhost");
  const authFetch = new AuthFetch(wallet);

  const fetchFundedAds = async () => {
    try {
      // First, fetch the list of funded ad IDs
      const response = await authFetch.fetch(
        "http://localhost:3000/funded-ads"
      );
      if (!response.ok) {
        throw new Error("Failed to fetch funded ads");
      }
      const { ads: fundedAdIds } = await response.json();

      if (fundedAdIds.length === 0) {
        setAdvertisements([]);
        setLoading(false);
        return;
      }

      // Then, fetch the advertisement details for each funded ad
      const resolver = new LookupResolver({ networkPreset: "local" });
      const lookupResult = (await resolver.query({
        service: "ls_advertisement",
        query: { ids: fundedAdIds },
      })) as any;

      console.log("lookupResult", {
        lookupResult,
        fundedAdIds,
        lookupResultType: lookupResult.outputs,
      });

      if (!lookupResult || lookupResult.type !== "output-list") {
        throw new Error("Invalid lookup result format");
      }

      const parsedAds: AdvertisementData[] = [];

      for (const output of lookupResult.outputs) {
        try {
          const tx = Transaction.fromBEEF(output.beef);
          const decoded = PushDrop.decode(
            tx.outputs[output.outputIndex].lockingScript
          );

          const txid = tx.id("hex");

          if (!decoded || !decoded.fields || decoded.fields.length < 8) {
            continue;
          }

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

          parsedAds.push(ad);
        } catch (error) {
          console.error("Failed to parse advertisement:", error);
        }
      }

      setAdvertisements(parsedAds);
    } catch (error) {
      console.error("Error fetching advertisements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFundedAds();
  }, []);

  const handleWatchAd = (ad: AdvertisementData) => {
    setSelectedAd(ad);
    setVideoModalOpen(true);
    setShowQuestions(false);
    setUserAnswers({});
    // Reset video when opening modal
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const handleCloseModal = () => {
    setVideoModalOpen(false);
    setShowQuestions(false);
    setUserAnswers({});
    // Reset video when closing modal
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const handleVideoEnded = async () => {
    if (!selectedAd) return;

    try {
      // Fetch questions for this ad
      const response = await authFetch.fetch(
        `http://localhost:3000/funding-records`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: [selectedAd.id] }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch questions");
      }

      const { fundingRecords } = await response.json();
      if (fundingRecords && fundingRecords.length > 0) {
        // Only use the first funding record
        const firstRecord = fundingRecords[0];
        const qaPairs = firstRecord.questions.map((q: string, i: number) => ({
          question: q,
          answer: firstRecord.answers[i],
        }));

        setQuestions(qaPairs);
        setShowQuestions(true);
      }
    } catch (error) {
      console.error("Error fetching questions:", error);
    }
  };

  const handleAnswerChange = (question: string, answer: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [question]: answer,
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmitAnswers = async () => {
    if (!selectedAd) return;

    try {
      const publicKey = await wallet.getPublicKey({ identityKey: true });
      const response = await authFetch.fetch(
        "http://localhost:3000/submit-answers",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            adId: selectedAd.id,
            answers: Object.values(userAnswers),
            publicKey: publicKey.publicKey,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to submit answers");
      }

      const quizResponse = await response.json();
      console.log("Quiz submission successful!", quizResponse);
      handleCloseModal();
    } catch (error) {
      console.error("Error submitting answers:", error);
    }
  };

  if (loading) {
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

  console.log("BONGO selectedAd", { selectedAd });

  return (
    <Box sx={{ p: 4, maxWidth: 1200, margin: "0 auto" }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: "bold" }}>
        Watch Ads
      </Typography>

      {advertisements.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No funded advertisements available
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

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    Reward per answer: {ad.rewardPerAnswer} sats
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    End date: {ad.endDate.toLocaleDateString()}
                  </Typography>
                </CardContent>

                <CardActions sx={{ justifyContent: "flex-end", p: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handleWatchAd(ad)}
                  >
                    Watch Ad
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Video Player Modal */}
      <Dialog
        open={videoModalOpen}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {selectedAd?.title}
            <IconButton
              edge="end"
              color="inherit"
              onClick={handleCloseModal}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedAd && (
            <Box
              sx={{ width: "100%", aspectRatio: "16/9", position: "relative" }}
            >
              <video
                ref={videoRef}
                autoPlay
                onEnded={handleVideoEnded}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              >
                <Source src={selectedAd.fileHash} />
              </video>
            </Box>
          )}

          {showQuestions && (
            <Fade in={showQuestions} timeout={500}>
              <Slide
                direction="up"
                in={showQuestions}
                mountOnEnter
                unmountOnExit
              >
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Answer these questions to earn {selectedAd?.rewardPerAnswer}{" "}
                    sats per correct answer
                  </Typography>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Question {currentQuestionIndex + 1} of {questions.length}
                    </Typography>
                    <Typography variant="h6" gutterBottom>
                      {questions[currentQuestionIndex].question}
                    </Typography>
                    <TextField
                      fullWidth
                      variant="outlined"
                      value={
                        userAnswers[questions[currentQuestionIndex].question] ||
                        ""
                      }
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleAnswerChange(
                          questions[currentQuestionIndex].question,
                          e.target.value
                        )
                      }
                      placeholder="Your answer"
                      sx={{ mb: 2 }}
                    />
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 2,
                    }}
                  >
                    <Button
                      variant="outlined"
                      onClick={handlePreviousQuestion}
                      disabled={currentQuestionIndex === 0}
                    >
                      Previous
                    </Button>
                    {currentQuestionIndex < questions.length - 1 ? (
                      <Button
                        variant="contained"
                        onClick={handleNextQuestion}
                        disabled={
                          !userAnswers[questions[currentQuestionIndex].question]
                        }
                      >
                        Next
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSubmitAnswers}
                        disabled={
                          !userAnswers[questions[currentQuestionIndex].question]
                        }
                      >
                        Submit
                      </Button>
                    )}
                  </Box>
                </Box>
              </Slide>
            </Fade>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Watch;
