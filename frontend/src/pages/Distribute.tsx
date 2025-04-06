import React from "react";
import { Typography, Box } from "@mui/material";
import { Outlet } from "react-router-dom";

const Distribute: React.FC = () => {
  return (
    <Box sx={{ width: "100%" }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ p: 3 }}>
        Distribute Ads
      </Typography>
      <Outlet />
    </Box>
  );
};

export default Distribute;
