import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Chip, Pagination
} from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

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
      const res = await axios.get(`${API_URL}/forms?page=${page}&limit=50`);
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
    <Box>
      <Typography variant="h4" gutterBottom>
        Tide BT Forms
      </Typography>

      <TableContainer component={Paper} sx={{ mt: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Customer Name</strong></TableCell>
              <TableCell><strong>Phone</strong></TableCell>
              <TableCell><strong>Employee</strong></TableCell>
              <TableCell><strong>Location</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Date</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {forms.map((form, index) => (
              <TableRow key={index} hover>
                <TableCell>{form.customerName}</TableCell>
                <TableCell>{form.customerNumber}</TableCell>
                <TableCell>{form.employeeName}</TableCell>
                <TableCell>{form.location}</TableCell>
                <TableCell>
                  <Chip 
                    label={form.status} 
                    color={form.status === 'Ready for Onboarding' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : '-'}
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
