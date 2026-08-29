import React, { useState, useEffect } from "react";
import { Box } from "@mui/material";
import Dashboard from "./Dashboard";
import Analytics from "./Analytics";
import Chat from "./Chat";

const Home = () => {
  const [dashboardWidth, setDashboardWidth] = useState(0); // Initial width of Dashboard
  const [analyticsWidth, setAnalyticsWidth] = useState(0); // Initial width of Analytics
  const [isResizing, setIsResizing] = useState(false); // To track resizing state
  const [initialX, setInitialX] = useState(0); // Initial mouse X position during resize
  const [initialDashboardWidth, setInitialDashboardWidth] = useState(0); // Initial width of Dashboard during resize

  // Set the initial dashboard and analytics width based on window size
  useEffect(() => {
    const initialWidth = window.innerWidth * 0.8; // 80% of the window width for Dashboard
    setDashboardWidth(initialWidth);
    setAnalyticsWidth(window.innerWidth - initialWidth - 20); // Remaining width for Analytics
  }, []);

  // Function to start the resizing process
  const startResizing = (e) => {
    setIsResizing(true);
    setInitialX(e.clientX);
    setInitialDashboardWidth(dashboardWidth);
  };

  // Function to handle resizing during the mouse movement
  const handleResizing = (e) => {
    if (isResizing) {
      const deltaX = e.clientX - initialX; // Calculate how far the mouse has moved
      const newDashboardWidth = initialDashboardWidth + deltaX; // Calculate the new width of the Dashboard
      if (
        newDashboardWidth >= 200 &&
        newDashboardWidth <= window.innerWidth - 200
      ) {
        setDashboardWidth(newDashboardWidth);
        setAnalyticsWidth(window.innerWidth - newDashboardWidth - 20); // Set Analytics width dynamically based on the remaining space
      }
    }
  };

  // Function to stop the resizing process
  const stopResizing = () => {
    setIsResizing(false);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        marginTop: 1,
        marginX: 0.5,
        marginBottom: 1,
        height: "100vh", // Full viewport height
      }}
      onMouseMove={handleResizing} // Handle mouse movement for resizing
      onMouseUp={stopResizing} // Stop resizing when mouse is released
    >
      {/* Dashboard Panel */}
      <Box
        sx={{
          width: dashboardWidth,
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Dashboard />
      </Box>

      {/* Vertical Resizable Separator */}
      <Box
        sx={{
          width: "5px", // Width of the resizable separator
          cursor: "ew-resize", // Change cursor to show resizing behavior
          height: "10%", // Full height
          margin: "auto",
          backgroundColor: "#d3d3d3", // Color of the separator
          borderRadius: "10%",
        }}
        onMouseDown={startResizing} // Start resizing when mouse is clicked on the separator
      />

      {/* Analytics (Chat Box) */}
      <Box
        sx={{
          width: analyticsWidth,
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Chat />
      </Box>
    </Box>
  );
};

export default Home;
