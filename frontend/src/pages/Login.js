import React, { useState } from "react";
import { Box, Card, CardContent, Typography, Button } from "@mui/material";
import { BRAND } from "../theme";

export default function Login() {
  const handleGoToTide = () => {
    // Redirect to main Tide admin login
    window.location.href = 'http://localhost:3000';
  };

  return (
    <Box sx={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #071a0f 0%, #0f3320 50%, #1a5c38 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", px: 2,
    }}>
      {/* Logo */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
        <Box component="img" src="/logo-full.png" alt="Vegavruddhi"
          sx={{ height: 52, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
        <Box>
          <Typography sx={{
            fontFamily: "'Georgia', serif", fontWeight: 700,
            fontSize: "1.4rem", color: "#fff", letterSpacing: 2,
            textTransform: "uppercase", lineHeight: 1.2,
          }}>
            Vegavruddhi
          </Typography>
          <Typography sx={{
            fontSize: "0.65rem", color: BRAND.accent,
            letterSpacing: 3, textTransform: "uppercase", fontWeight: 600,
          }}>
            Tide BT Admin
          </Typography>
        </Box>
      </Box>

      {/* Card */}
      <Card sx={{ width: "100%", maxWidth: 480, borderRadius: 3, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
        <CardContent sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 2, color: BRAND.primary }}>
            Access Restricted
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
            Tide BT Admin can only be accessed through the main Tide Admin panel.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6 }}>
            Please login to the <strong>Tide Admin</strong> first, then click the <strong>"Tide BT Dashboard"</strong> button to access this panel.
          </Typography>

          <Button
            variant="contained"
            size="large"
            onClick={handleGoToTide}
            sx={{
              py: 1.5,
              px: 4,
              fontSize: '1rem',
              fontWeight: 700,
              bgcolor: BRAND.primary,
              '&:hover': {
                bgcolor: BRAND.primaryMid,
              }
            }}
          >
            Go to Tide Admin Login
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
