import {
  Box,
  Card,
  CardContent,
  Divider,
  IconButton,
  Typography,
} from "@mui/material";
import { Menu } from "@mui/icons-material";
import logo from "../assets/coopinsights.png";
import React from "react";

const Dashboard = () => {
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
        }}
      >
        <IconButton sx={{ backgroundColor: "#fff", color: "#000" }}>
          <Menu fontWeight="70px" />
        </IconButton>
        <Box>
          <img src={logo} width={100} height={20} alt="Coop Insight Logo" />
        </Box>
        <Divider
          sx={{
            marginX: 2,
            width: "100%",
            height: 2,
            color: "#f0f0f0",
          }}
        />
      </Box>
      <Box sx={{ marginX: 1 }}>
        <Typography sx={{ fontWeight: "Bold" }}>Dashboard</Typography>
        <Box
          sx={{
            display: "flex",
            width: "100%",
            flexDirection: { xs: "column", sm: "column", md: "row" },
            justifyContent: "space-between",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 1,
              backgroundColor: "#000",
              color: "#fff",
              padding: "8px 16px",
            }}
          >
            <Typography sx={{ fontWeight: "bold", fontSize: "18px" }}>
              14+
            </Typography>
            <Typography sx={{ fontSize: "16px" }}>Customers</Typography>
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 1,
              backgroundColor: "#fff",
              color: "#000",
              padding: "8px 16px",
            }}
          >
            <Typography sx={{ fontWeight: "bold", fontSize: "18px" }}>
              700K+
            </Typography>
            <Typography sx={{ fontSize: "16px" }}>MSME's financed</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
