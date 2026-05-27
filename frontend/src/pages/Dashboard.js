import React, { useState, useEffect } from 'react';
import { Grid, Card, CardContent, Typography, Box, CircularProgress } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalFSEs: 0,
    totalTLs: 0,
    totalForms: 0,
    pendingTransfers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [fseRes, tlRes, formsRes] = await Promise.all([
        axios.get(`${API_URL}/fse`),
        axios.get(`${API_URL}/tl`),
        axios.get(`${API_URL}/forms/stats`)
      ]);

      setStats({
        totalFSEs: fseRes.data.total || 0,
        totalTLs: tlRes.data.total || 0,
        totalForms: formsRes.data.stats?.totalForms || 0,
        pendingTransfers: 0 // Placeholder
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'Total FSEs', value: stats.totalFSEs, icon: <PeopleIcon />, color: '#1976d2' },
    { title: 'Total TLs', value: stats.totalTLs, icon: <SupervisorAccountIcon />, color: '#2e7d32' },
    { title: 'Total Forms', value: stats.totalForms, icon: <DescriptionIcon />, color: '#ed6c02' },
    { title: 'Pending Transfers', value: stats.pendingTransfers, icon: <AccountBalanceIcon />, color: '#9c27b0' },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ bgcolor: card.color, color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {card.value}
                    </Typography>
                    <Typography variant="body2">
                      {card.title}
                    </Typography>
                  </Box>
                  <Box sx={{ fontSize: 48, opacity: 0.8 }}>
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
