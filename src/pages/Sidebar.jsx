import React from "react";
import logo from "../assets/coopinsights.png";
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";

const Sidebar = () => {
  const navigate = useNavigate();

  const menuItems = [
    { text: "Dashboard", icon: <HomeIcon />, path: "/dashboard" },
    { text: "Analytics", icon: <AnalyticsIcon />, path: "/analytics" },
    { text: "Setting", icon: <SettingsIcon />, path: "./setting" },
    { text: "Logout", icon: <LogoutIcon />, path: "/logout" },
  ];

  return (
    <Box
      sx={{
        width: 250,
        backgroundColor: "rgb(218, 218, 218)",
        color: "#000",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Logo Section */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 2,
        }}
      >
        <img src={logo} width={140} height={35} alt="Coop Insight Logo" />
      </Box>

      {/* Navigation Items */}
      <List sx={{ flexGrow: 1 }}>
        {menuItems.map((item, index) => (
          <ListItem
            button
            key={item.text}
            onClick={() => navigate(item.path)}
            sx={{
              "&:hover": {
                backgroundColor: "#e38524",
              },
            }}
          >
            <ListItemIcon sx={{ color: "#000" }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>

      {/* Footer */}
      <Box
        sx={{
          padding: 2,
          textAlign: "center",
          fontSize: "0.8rem",
          color: "#00000",
        }}
      >
        &copy; 2025 Coop Insights
      </Box>
    </Box>
  );
};

export default Sidebar;
