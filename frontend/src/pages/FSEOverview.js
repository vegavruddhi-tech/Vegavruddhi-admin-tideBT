import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Chip
} from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export default function FSEOverview() {
  const [fses, setFses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFSEs();
  }, []);

  const fetchFSEs = async () => {
    try {
      const res = await axios.get(`${API_URL}/fse`);
      setFses(res.data.fses || []);
    } catch (error) {
      console.error('Error fetching FSEs:', error);
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
        FSE Overview
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Total FSEs: {fses.length}
      </Typography>

      <TableContainer component={Paper} sx={{ mt: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Phone</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Reporting Manager</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fses.map((fse, index) => (
              <TableRow key={index} hover>
                <TableCell>{fse.name}</TableCell>
                <TableCell>{fse.phone}</TableCell>
                <TableCell>{fse.email}</TableCell>
                <TableCell>{fse.reportingManager}</TableCell>
                <TableCell>
                  <Chip 
                    label={fse.status || 'active'} 
                    color={fse.status === 'active' ? 'success' : 'default'}
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
