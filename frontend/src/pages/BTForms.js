import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Chip, Pagination
} from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export default function BTForms() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchForms();
  }, [page]);

  const fetchForms = async () => {
    try {
      const res = await axios.get(`${API_URL}/forms?page=${page}&limit=50&formType=bt-forms`);
      setForms(res.data.forms || []);
      setTotalPages(res.data.pages || 1);
    } catch (error) {
      console.error('Error fetching forms:', error);
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
    <Box p={3}>
      <Typography variant="h4" fontWeight={700} sx={{ color: '#1a5c38' }} gutterBottom>
        Tide BT Forms
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Daily Visit and Onboarding Responses
      </Typography>

      <TableContainer component={Paper} sx={{ mt: 3, border: '1.5px solid #e0e0e0', borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', bgcolor: '#f5f5f5' } }}>
              <TableCell>Merchant Name</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Employee</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {forms.map((form, index) => (
              <TableRow key={index} hover>
                <TableCell sx={{ fontWeight: 600 }}>{form.merchantName || form.customerName || '-'}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{form.merchantNumber || form.customerNumber || '-'}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{form.employeeName || '-'}</TableCell>
                <TableCell>
                  <Chip 
                    label={form.merchantCategory || 'Others'} 
                    size="small" 
                    variant="outlined"
                    color="primary"
                    sx={{ fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={form.status || form.onboardingStatus || 'Pending'} 
                    color={
                      (form.status === 'Ready for Onboarding' || form.onboardingStatus === 'Completed') 
                        ? 'success' 
                        : 'default'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {form.createdAt ? new Date(form.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box display="flex" justifyContent="center" mt={3}>
        <Pagination 
          count={totalPages} 
          page={page} 
          onChange={(e, value) => setPage(value)}
          color="primary"
        />
      </Box>
    </Box>
  );
}
