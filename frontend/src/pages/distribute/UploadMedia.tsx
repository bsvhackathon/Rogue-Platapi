import React, { useState } from "react";
import { Box, Typography, Snackbar, Alert } from "@mui/material";
import { AdUploadForm } from "../../components/AdUploadForm";
import { AdUploadData } from "../../components/AdUploadForm";

const UploadMedia: React.FC = () => {
  const [uploadStatus, setUploadStatus] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const handleSubmit = async (adData: AdUploadData) => {
    try {
      // TODO: Add your backend integration here
      console.log("Uploaded ad data:", adData);

      setUploadStatus({
        open: true,
        message: "Ad campaign uploaded successfully!",
        severity: "success",
      });
    } catch (error) {
      console.error("Failed to upload ad:", error);
      setUploadStatus({
        open: true,
        message: "Failed to upload ad campaign. Please try again.",
        severity: "error",
      });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <AdUploadForm onSubmit={handleSubmit} />
      <Snackbar
        open={uploadStatus.open}
        autoHideDuration={6000}
        onClose={() => setUploadStatus({ ...uploadStatus, open: false })}
      >
        <Alert severity={uploadStatus.severity}>{uploadStatus.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default UploadMedia;
