import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import React from "react";
import { ArrowRight } from "@mui/icons-material";

const Chat = () => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column", // Stack elements vertically
        justifyContent: "space-between", // Ensure that input is at the bottom
        height: "100vh", // Take full viewport height
        paddingX: 2,
        backgroundColor: "inherit", // Light background for the entire chat box area
      }}
    >
      {/* Box for displaying the search result */}
      <Box
        sx={{
          flexGrow: 1, // This allows the box to take all available space above the input
          overflowY: "auto", // Allows scroll if content overflows
          marginTop: 0.5,
          paddingX: 0.5,
          backgroundColor: "#d3d3d3", // Light grey background for the search result area
          // border: 2,
        }}
      >
        dssdfgsdfgsdfgsdf
      </Box>

      {/* Text input for chat */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center", // Centers the input horizontally
          alignItems: "center", // Centers the input vertically
          padding: 2,
          backgroundColor: "inherit", // Light background for the chat box area
        }}
      >
        <TextField
          sx={{
            width: "100%", // Make the text field take full width
            maxWidth: 600, // Max width of the text field
            backgroundColor: "#fff", // White background for the text field
          }}
          placeholder="Ask away..."
          variant="outlined"
          size="small"
          multiline // Makes the TextField a TextArea
          minRows={1} // Minimum number of rows
          maxRows={3} // Maximum number of rows
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton>
                  <ArrowRight />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>
    </Box>
  );
};

export default Chat;
