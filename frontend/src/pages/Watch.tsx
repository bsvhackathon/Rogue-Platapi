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
  Alert,
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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import confetti from "canvas-confetti";

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

// Add Confetti component
const Confetti: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const myConfetti = confetti.create(canvasRef.current, {
        resize: true,
        useWorker: true,
      });

      myConfetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      return () => {
        // Cleanup
        if (canvasRef.current) {
          canvasRef.current.width = 0;
          canvasRef.current.height = 0;
        }
      };
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
};

const Watch: React.FC = () => {
  const [advertisements, setAdvertisements] = useState<AdvertisementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<AdvertisementData | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions, setQuestions] = useState<QuestionAnswer[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [rewardedAds, setRewardedAds] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [earnedSats, setEarnedSats] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<HTMLCanvasElement>(null);

  const wallet = new WalletClient("auto", "localhost");
  const authFetch = new AuthFetch(wallet);

  const fetchRewardedAds = async () => {
    try {
      const publicKey = await wallet.getPublicKey({ identityKey: true });
      const response = await authFetch.fetch(
        "http://localhost:3000/rewarded-ads",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ publicKey: publicKey.publicKey }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch rewarded ads");
      }

      const { rewardedAds } = await response.json();
      setRewardedAds(rewardedAds);
    } catch (error) {
      console.error("Error fetching rewarded ads:", error);
    }
  };

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
    fetchRewardedAds();
  }, []);

  const handleWatchAd = (ad: AdvertisementData) => {
    setSelectedAd(ad);
    setVideoModalOpen(true);
    setShowQuestions(false);
    setShowSuccess(false);
    setUserAnswers({});
    // Reset video when opening modal
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const handleCloseModal = () => {
    setVideoModalOpen(false);
    setShowQuestions(false);
    setShowSuccess(false);
    setShowConfetti(false);
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
        "http://localhost:3000/funding-records",
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
      setIsSubmitting(true);
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

      // Show success animation
      setEarnedSats(quizResponse.correctAnswers * selectedAd.rewardPerAnswer);
      setShowSuccess(true);
      setShowConfetti(true);

      // Refetch rewarded ads to update the UI
      await fetchRewardedAds();
    } catch (error) {
      console.error("Error submitting answers:", error);
    } finally {
      setIsSubmitting(false);
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
                    disabled={rewardedAds.includes(ad.id)}
                  >
                    {rewardedAds.includes(ad.id)
                      ? "Already Watched"
                      : "Watch Ad"}
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
        sx={{
          "& .MuiDialog-paper": {
            position: "relative",
            overflow: "visible",
          },
        }}
      >
        {/* Confetti Canvas */}
        {showConfetti && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1300,
              pointerEvents: "none",
            }}
          >
            <canvas
              ref={confettiRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            />
          </Box>
        )}

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

          {showQuestions && !showSuccess && (
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
                      disabled={isSubmitting}
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
                      disabled={currentQuestionIndex === 0 || isSubmitting}
                    >
                      Previous
                    </Button>
                    {currentQuestionIndex < questions.length - 1 ? (
                      <Button
                        variant="contained"
                        onClick={handleNextQuestion}
                        disabled={
                          !userAnswers[
                            questions[currentQuestionIndex].question
                          ] || isSubmitting
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
                          !userAnswers[
                            questions[currentQuestionIndex].question
                          ] || isSubmitting
                        }
                        startIcon={
                          isSubmitting ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : null
                        }
                      >
                        {isSubmitting ? "Submitting..." : "Submit"}
                      </Button>
                    )}
                  </Box>
                </Box>
              </Slide>
            </Fade>
          )}

          {showSuccess && (
            <Fade in={showSuccess} timeout={500}>
              <Box
                sx={{
                  mt: 3,
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {showConfetti && <Confetti />}
                <CheckCircleIcon color="success" sx={{ fontSize: 60 }} />
                <Typography variant="h5" gutterBottom>
                  Congratulations!
                </Typography>
                <Typography variant="h6" color="primary">
                  You earned {earnedSats} satoshis!
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleCloseModal}
                  sx={{ mt: 2 }}
                >
                  Close
                </Button>
              </Box>
            </Fade>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Watch;
