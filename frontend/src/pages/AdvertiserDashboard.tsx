import React from "react";
import { Container, Typography, Box } from "@mui/material";
import { AdUploadForm } from "../components/AdUploadForm";

interface AdUploadData {
  title: string;
  description: string;
  videoFile: File;
  retentionPeriod: number;
  uhrpUrl?: string;
}

export const AdvertiserDashboard: React.FC = () => {
  const handleAdUpload = async (adData: AdUploadData) => {
    // TODO: Implement ad campaign creation logic
    console.log("Ad uploaded:", adData);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Advertiser Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" paragraph>
          Create and manage your ad campaigns
        </Typography>

        <AdUploadForm onSubmit={handleAdUpload} />
      </Box>
    </Container>
  );
};
