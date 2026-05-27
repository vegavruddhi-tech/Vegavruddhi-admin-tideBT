import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Chip
} from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export default function TLOverview() {
  const [tls, setTls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTLs();
  }, []);

  const fetchTLs = async () => {
    try {
      const res = await axios.get(`${API_URL}/tl`);
      setTls(res.data.tls || []);
    } catch (error) {
      console.error('Error fetching TLs:', error);
    } finally {
      setLoading(false);
    }
  };

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
        TL Overview
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Total TLs: {tls.length}
      </Typography>

      <TableContainer component={Paper} sx={{ mt: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Phone</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>FSE Count</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tls.map((tl, index) => (
              <TableRow key={index} hover>
                <TableCell>{tl.name}</TableCell>
                <TableCell>{tl.phone}</TableCell>
                <TableCell>{tl.email}</TableCell>
                <TableCell>
                  <Chip label={tl.fseCount} color="primary" size="small" />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={tl.status || 'active'} 
                    color={tl.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
