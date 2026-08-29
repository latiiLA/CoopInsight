import React from "react";
import logo from "../assets/coopinsights.png";
import { Box, Button, TextField, Typography } from "@mui/material";
import * as Yup from "yup";
import { Formik, Form, ErrorMessage } from "formik";
import search from "../assets/analytics_search.png";
import data_analyics1 from "../assets/data-analytics.png";
import data_analyics2 from "../assets/investment.png";
import db from "../assets/database.png";
import analtics_skills from "../assets/analytical-skills.png";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const initialValues = { email: "", password: "" };
  const navigate = useNavigate();

  const VALIDATIONSCHEMA = Yup.object({
    email: Yup.string().email("Invalid email").required("Email Required"),
    password: Yup.string().required("Password Required"),
  });

  const handleSubmit = (values) => {
    console.log("Form submitted:", values);
  };

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: "15%",
          left: "5%",
          width: "100%",
          height: "80%",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "auto auto",
          gap: "30px",
        }}
      >
        <img
          src={data_analyics1}
          alt="Top Image 1"
          style={{ width: "250px", opacity: 0.05, pointerEvents: "none" }}
        />
        <img
          src={analtics_skills}
          alt="Top Image 2"
          style={{ width: "250px", opacity: 0.05, pointerEvents: "none" }}
        />
        <img
          src={data_analyics2}
          alt="Top Image 3"
          style={{
            width: "250px",
            opacity: 0.05,
            marginBottom: "20px !important",
            pointerEvents: "none",
          }}
        />

        <img
          src={db}
          alt="Bottom Left Image 1"
          style={{
            width: "250px",
            opacity: 0.05,
            gridColumn: "1",
            alignSelf: "center",
            pointerEvents: "none",
          }}
        />
        <img
          src={search}
          alt="Bottom Left Image 2"
          style={{
            width: "250px",
            opacity: 0.05,
            gridColumn: "2",
            alignSelf: "center",
            pointerEvents: "none",
          }}
        />
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          marginX: 5,
          marginY: 3,
          paddingBottom: 10,
        }}
      >
        <Box>
          <img src={logo} width={140} height={35} alt="Coop Insight Logo" />
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "center",
            alignItems: "center",
            paddingY: { xs: 2, md: 15 },
            margin: "auto",
            flexWrap: "wrap",
          }}
        >
          {/* Text Content Box */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              flexDirection: "column",
              alignItems: "center",
              width: { xs: "100%", sm: "75%", md: "50%" },
            }}
          >
            <Typography
              variant="h5"
              fontWeight="bold"
              sx={{ textAlign: "center" }}
            >
              Coop Insights!
            </Typography>
            <Typography
              sx={{
                textAlign: "center",
                width: "80%",
                margin: "auto",
                padding: "16px 0",
              }}
            >
              Unlock the power of your data with Coop Insights-an advanced
              AI-driven analytics tool designed to provide actionable insights
              and comprehensive reports. By seamlessly fetching and analyzing
              data from your local database, Coop Insights helps management
              teams make informed decisions, optimize operations, and drive
              growth. Experience smarter, faster decision-making with tailored
              insights at your fingertips. Transform your data into strategic
              advantage today.
            </Typography>
          </Box>

          {/* Form Box */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              width: { xs: "100%", sm: "75%", md: "40%" },
              position: "relative",
              zIndex: 2,
            }}
          >
            <Formik
              initialValues={initialValues}
              validationSchema={VALIDATIONSCHEMA}
              onSubmit={handleSubmit}
            >
              {({ handleChange, handleBlur, touched, errors }) => (
                <Form>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.5,
                      padding: { xs: 0, sm: 5 },
                    }}
                  >
                    <Typography
                      variant="h5"
                      sx={{ textAlign: "left", fontWeight: "bold" }}
                    >
                      Login
                    </Typography>
                    <TextField
                      name="email"
                      type="email"
                      label="Email"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.email && Boolean(errors.email)}
                      helperText={touched.email && errors.email}
                      sx={{ marginBottom: 2 }}
                    />
                    <TextField
                      name="password"
                      type="password"
                      label="Password"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.password && Boolean(errors.password)}
                      helperText={touched.password && errors.password}
                      sx={{ marginBottom: 2 }}
                    />
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "flex-start",
                        width: "100%",
                      }}
                    >
                      <Button
                        sx={{
                          textAlign: "left",
                          textTransform: "none",
                          color: "#000",
                          padding: 0,
                          fontWeight: "bold",
                        }}
                        onClick={() => navigate("/changepassword")}
                      >
                        Forgot password?
                      </Button>
                    </Box>

                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        width: "100%",
                      }}
                    >
                      <Button
                        variant="contained"
                        type="submit"
                        sx={{
                          textTransform: "none",
                          marginTop: 2,
                          flexDirection: "flex-end",
                          backgroundColor: "#e38524",
                          color: "#000",
                          fontWeight: "bold",
                        }}
                      >
                        Login
                      </Button>
                    </Box>
                  </Box>
                </Form>
              )}
            </Formik>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
