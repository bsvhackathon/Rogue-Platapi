import React, { useState, type FormEvent } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AppBar,
  Toolbar,
  Fab,
  LinearProgress,
  Typography,
  IconButton,
  Grid,
  Tabs,
  Tab,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
} from "@mui/material";
import { styled } from "@mui/system";
import { ProtoWallet, WalletClient } from "@bsv/sdk";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Link,
  useLocation,
} from "react-router-dom";
import UploadIcon from "@mui/icons-material/CloudUpload";
import StorageIcon from "@mui/icons-material/Storage";
import Watch from "./pages/Watch";
import Distribute from "./pages/Distribute";
import UploadMedia from "./pages/distribute/UploadMedia";
import ManageMedia from "./pages/distribute/ManageMedia";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const drawerWidth = 240;

const Navigation: React.FC = () => {
  const location = useLocation();

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme: any) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AdDirect
          </Typography>
          <Button color="inherit" component={Link} to="/">
            Watch
          </Button>
          <Button color="inherit" component={Link} to="/distribute">
            Distribute
          </Button>
        </Toolbar>
      </AppBar>
      {location.pathname.startsWith("/distribute") && (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              marginTop: "64px",
            },
          }}
        >
          <List>
            <ListItem
              button
              component={Link}
              to="/distribute/upload"
              selected={location.pathname === "/distribute/upload"}
            >
              <ListItemIcon>
                <UploadIcon />
              </ListItemIcon>
              <ListItemText primary="Upload Media" />
            </ListItem>
            <ListItem
              button
              component={Link}
              to="/distribute/manage"
              selected={location.pathname === "/distribute/manage"}
            >
              <ListItemIcon>
                <StorageIcon />
              </ListItemIcon>
              <ListItemText primary="Manage Media" />
            </ListItem>
          </List>
        </Drawer>
      )}
      <Box component="main" sx={{ flexGrow: 1, p: 3, marginTop: "64px" }}>
        <Routes>
          <Route path="/" element={<Watch />} />
          <Route path="/distribute" element={<Distribute />}>
            <Route index element={<UploadMedia />} />
            <Route path="upload" element={<UploadMedia />} />
            <Route path="manage" element={<ManageMedia />} />
          </Route>
        </Routes>
      </Box>
    </Box>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Navigation />
    </Router>
  );
};

export default App;
