import React from "react";
import { Typography, Box } from "@mui/material";
import { Outlet } from "react-router-dom";

const Distribute: React.FC = () => {
  return (
    <Box sx={{ width: "100%" }}>
      <Outlet />
    </Box>
  );
};

export default Distribute;
