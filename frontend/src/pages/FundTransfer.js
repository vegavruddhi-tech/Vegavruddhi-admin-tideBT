import React from 'react';
import { Box, Typography, Paper, Alert } from '@mui/material';

export default function FundTransfer() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Fund Transfer
      </Typography>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Alert severity="info">
          Fund transfer functionality will be added here. Please provide the requirements for this feature.
        </Alert>
      </Paper>
    </Box>
  );
}
