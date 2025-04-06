import React, { useState } from "react";
import { Box, Button, TextField, Typography, Paper } from "@mui/material";
import { AuthFetch, WalletClient, Utils, AtomicBEEF } from "@bsv/sdk";
import { toast } from "react-toastify";

interface QuizFormProps {
  adId: string;
  questions: string[];
  rewardPerAnswer: number;
}

interface QuizResponse {
  transaction: string;
  derivationPrefix: string;
  derivationSuffix: string;
  amount: number;
  senderIdentityKey: string;
  correctAnswers: number;
}

export const QuizForm: React.FC<QuizFormProps> = ({
  adId,
  questions,
  rewardPerAnswer,
}) => {
  const [answers, setAnswers] = useState<string[]>(
    Array(questions.length).fill("")
  );
  const [loading, setLoading] = useState(false);

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const wallet = new WalletClient("auto", "localhost");
      const authFetch = new AuthFetch(wallet);
      const publicKey = await wallet.getPublicKey({ identityKey: true });

      const response = await authFetch.fetch(
        "http://localhost:3000/submit-answers",
        {
          method: "POST",
          body: JSON.stringify({
            adId,
            answers,
            publicKey: publicKey.publicKey,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to submit answers");
      }

      const quizResponse = (await response.json()) as QuizResponse;

      // Process the payment transaction
      const processedTx = await wallet.internalizeAction({
        tx: Utils.toArray(quizResponse.transaction, "base64") as AtomicBEEF,
        outputs: [
          {
            paymentRemittance: {
              derivationPrefix: quizResponse.derivationPrefix,
              derivationSuffix: quizResponse.derivationSuffix,
              senderIdentityKey: quizResponse.senderIdentityKey,
            },
            outputIndex: 0,
            protocol: "wallet payment",
          },
        ],
        description: `Quiz reward for ad ${adId}`,
      });

      console.log("Quiz submission successful!", processedTx);
      toast.success(
        `You earned ${quizResponse.amount} satoshis for ${quizResponse.correctAnswers} correct answers!`
      );
    } catch (error) {
      console.error("Error submitting quiz answers:", error);
      toast.error("Failed to submit quiz answers");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Quiz
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Answer the questions to earn {rewardPerAnswer} satoshis per correct
        answer
      </Typography>
      {questions.map((question, index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Typography variant="body1" gutterBottom>
            {question}
          </Typography>
          <TextField
            fullWidth
            value={answers[index]}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleAnswerChange(index, e.target.value)
            }
            disabled={loading}
          />
        </Box>
      ))}
      <Button
        variant="contained"
        color="primary"
        onClick={handleSubmit}
        disabled={loading || answers.some((answer) => !answer)}
      >
        {loading ? "Submitting..." : "Submit Answers"}
      </Button>
    </Paper>
  );
};
