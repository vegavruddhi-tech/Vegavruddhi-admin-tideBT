import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Pagination,
  Card, CardContent, Grid, TextField, MenuItem, Button, Autocomplete
} from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function MobikwikForms() {
  const [allForms, setAllForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const rowsPerPage = 50;

  // Filter States
  const [selectedFse, setSelectedFse] = useState('');
  const [selectedTl, setSelectedTl] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fseList, setFseList] = useState([]);
  const [tlList, setTlList] = useState([]);

  useEffect(() => {
    const fetchLists = async () => {
      try {
        const [fseRes, tlRes] = await Promise.all([
          axios.get(`${API_URL}/fse`),
          axios.get(`${API_URL}/tl`)
        ]);
        setFseList(fseRes.data.fses || []);
        setTlList(tlRes.data.tls || []);
      } catch (err) {
        console.error('Error fetching FSE/TL lists:', err);
      }
    };
    fetchLists();
    fetchAllForms();
  }, []);

  const fetchAllForms = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/forms?limit=10000&formType=mobikwik-withdraw`);
      setAllForms(res.data.forms || []);
    } catch (error) {
      console.error('Error fetching Mobikwik forms:', error);
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering
  const filteredForms = useMemo(() => {
    return allForms.filter(f => {
      // Date filter — use createdAt OR month field
      if (selectedYear || selectedMonth) {
        // Try month field first (e.g. "Jan-25", "Jun-26")
        const monthField = f.month || '';
        const d = new Date(f.createdAt);
        let yearMatch = true, monthMatch = true;

        if (selectedYear) {
          const yr = selectedYear.toString().slice(-2); // "2026" → "26"
          const fullYr = parseInt(selectedYear);
          // Check month field (e.g. "Jun-26") OR createdAt year
          const monthFieldYearMatch = monthField.includes(`-${yr}`);
          const createdAtYearMatch = !isNaN(d) && d.getFullYear() === fullYr;
          yearMatch = monthFieldYearMatch || createdAtYearMatch;
        }

        if (selectedMonth) {
          const shortMonth = new Date(`${selectedMonth} 1, 2000`).toLocaleString('en-US', { month: 'short' }); // "June" → "Jun"
          // Check month field (e.g. "Jun-26") OR createdAt month
          const monthFieldMonthMatch = monthField.startsWith(shortMonth);
          const createdAtMonthMatch = !isNaN(d) && d.toLocaleString('en-US', { month: 'long' }) === selectedMonth;
          monthMatch = monthFieldMonthMatch || createdAtMonthMatch;
        }

        if (!yearMatch || !monthMatch) return false;
      }
      // Date range filter
      if (fromDate || toDate) {
        const d = new Date(f.createdAt || f._syncedAt);
        if (isNaN(d)) return false;
        if (fromDate && d < new Date(fromDate)) return false;
        if (toDate && d > new Date(toDate + 'T23:59:59')) return false;
      }
      // FSE filter
      const fseName = f.employeeName || f.fse || '';
      if (selectedFse && fseName.toLowerCase() !== selectedFse.toLowerCase()) return false;
      // TL filter
      if (selectedTl && (f.tl || '').toLowerCase() !== selectedTl.toLowerCase()) return false;
      return true;
    });
  }, [allForms, selectedYear, selectedMonth, selectedFse, selectedTl, fromDate, toDate]);

  // Paginated
  const paginatedForms = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredForms.slice(start, start + rowsPerPage);
  }, [filteredForms, page]);

  const totalPages = Math.ceil(filteredForms.length / rowsPerPage);
  const totalAmount = filteredForms.reduce((sum, f) => sum + (f.withdrawAmount || 0), 0);
  const totalFees = Math.round(totalAmount * 0.03 * 100) / 100;

  const handleReset = () => {
    setSelectedFse('');
    setSelectedTl('');
    setSelectedYear(new Date().getFullYear().toString());
    setSelectedMonth(new Date().toLocaleString('en-US', { month: 'long' }));
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  if (loading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress sx={{ color: '#7e22ce' }} /></Box>;
  }

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight={700} sx={{ color: '#7e22ce' }} gutterBottom>
        Mobikwik Withdrawal Forms
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Logged withdrawals and fees recorded by ground team
      </Typography>

      {/* Filter Section */}
      <Card sx={{ mb: 3, borderRadius: 2, border: '1.5px solid #e1bee7', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            {/* Year */}
            <Grid item xs={6} sm={2}>
              <TextField select fullWidth label="Year" value={selectedYear}
                onChange={e => { setSelectedYear(e.target.value); setPage(1); }} size="small">
                <MenuItem value="">All Years</MenuItem>
                {years.map(y => <MenuItem key={y} value={y.toString()}>{y}</MenuItem>)}
              </TextField>
            </Grid>
            {/* Month */}
            <Grid item xs={6} sm={2}>
              <TextField select fullWidth label="Month" value={selectedMonth}
                onChange={e => { setSelectedMonth(e.target.value); setPage(1); }} size="small">
                <MenuItem value="">All Months</MenuItem>
                {MONTHS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            {/* FSE */}
            <Grid item xs={12} sm={3}>
              <Autocomplete
                options={fseList.map(f => f.name)}
                value={selectedFse || null}
                onChange={(_, val) => { setSelectedFse(val || ''); setPage(1); }}
                size="small"
                renderInput={(params) => (
                  <TextField {...params} label="Filter by FSE" size="small"
                    sx={{ '& .MuiOutlinedInput-root': { '&.Mui-focused fieldset': { borderColor: '#7e22ce' } } }} />
                )}
              />
            </Grid>
            {/* TL */}
            <Grid item xs={12} sm={3}>
              <Autocomplete
                options={tlList.map(t => t.name)}
                value={selectedTl || null}
                onChange={(_, val) => { setSelectedTl(val || ''); setPage(1); }}
                size="small"
                renderInput={(params) => (
                  <TextField {...params} label="Filter by TL" size="small"
                    sx={{ '& .MuiOutlinedInput-root': { '&.Mui-focused fieldset': { borderColor: '#7e22ce' } } }} />
                )}
              />
            </Grid>
            {/* Reset */}
            <Grid item xs={12} sm={2}>
              <Button fullWidth variant="outlined" onClick={handleReset}
                sx={{ color: '#7e22ce', borderColor: '#7e22ce', fontWeight: 700, height: 40 }}>
                Reset
              </Button>
            </Grid>
            {/* Date Range */}
            <Grid item xs={6} sm={2}>
              <TextField fullWidth label="From Date" type="date" value={fromDate}
                onChange={e => { setFromDate(e.target.value); setPage(1); }} size="small"
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField fullWidth label="To Date" type="date" value={toDate}
                onChange={e => { setToDate(e.target.value); setPage(1); }} size="small"
                InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '5px solid #7e22ce', borderRadius: 2 }}>
            <CardContent>
              <Typography color="text.secondary" variant="overline" fontWeight={700}>Total Transactions</Typography>
              <Typography variant="h4" fontWeight={800} color="#7e22ce">{filteredForms.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '5px solid #2e7d32', borderRadius: 2 }}>
            <CardContent>
              <Typography color="text.secondary" variant="overline" fontWeight={700}>Total Withdraw Amount</Typography>
              <Typography variant="h4" fontWeight={800} color="#2e7d32">₹{totalAmount.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '5px solid #c62828', borderRadius: 2 }}>
            <CardContent>
              <Typography color="text.secondary" variant="overline" fontWeight={700}>Total Withdraw Fees</Typography>
              <Typography variant="h4" fontWeight={800} color="#c62828">₹{totalFees.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <TableContainer component={Paper} sx={{ border: '1.5px solid #e1bee7', borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, color: '#7e22ce', bgcolor: '#f3e5f5' } }}>
              <TableCell>Customer Name</TableCell>
              <TableCell>Phone Number</TableCell>
              <TableCell>Employee Name</TableCell>
              <TableCell>Withdraw Amount</TableCell>
              <TableCell>Withdraw Fees</TableCell>
              <TableCell>Reason/Remarks</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedForms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>No Mobikwik forms found.</TableCell>
              </TableRow>
            ) : (
              paginatedForms.map((form, index) => (
                <TableRow key={index} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{form.merchantName || form.customerName || '-'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{form.merchantNumber || form.customerNumber || '-'}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{form.fse || form.employeeName || '-'}</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#2e7d32' }}>₹{(form.withdrawAmount || 0).toLocaleString()}</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#c62828' }}>
                    ₹{((form.withdrawAmount || 0) * 0.03).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>{form.reasonOfWithdraw || '-'}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {form.createdAt ? new Date(form.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination count={totalPages} page={page} onChange={(e, v) => setPage(v)} color="secondary" />
        </Box>
      )}
    </Box>
  );
}
