import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Button, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, CircularProgress, Alert, Grid, Autocomplete, Tabs, Tab, Tooltip, IconButton
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DateFilter from '../components/DateFilter';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function FundTransfer() {
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [selectedTlFilter, setSelectedTlFilter] = useState('');
  const [selectedFseFilter, setSelectedFseFilter] = useState('');

  // Data
  const [fses, setFses] = useState([]);
  const [tls, setTls] = useState([]);
  const [payments, setPayments] = useState([]);
  const [usageSummary, setUsageSummary] = useState([]);
  const [mobikwikForms, setMobikwikForms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [step, setStep] = useState(1);
  const [transferToWhom, setTransferToWhom] = useState('');
  const [senderName, setSenderName] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDoneOn, setPaymentDoneOn] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [roleFilter, setRoleFilter] = useState('all');
  const [reportingPeriod, setReportingPeriod] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [bustingCache, setBustingCache] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Re-fetch usage summary whenever any date filter changes
  useEffect(() => {
    // For custom range, wait until both dates are complete valid dates before fetching
    if (dateFilter === 'custom') {
      const from = new Date(fromDate);
      const to   = new Date(toDate);
      if (!fromDate || !toDate || isNaN(from.getTime()) || isNaN(to.getTime())) return;
    }

    const params = new URLSearchParams();
    if (dateFilter) params.set('dateFilter', dateFilter);
    if (selectedYear) params.set('selectedYear', selectedYear);
    if (selectedMonth) params.set('selectedMonth', selectedMonth);
    if (dateFilter === 'custom' && fromDate) params.set('fromDate', fromDate);
    if (dateFilter === 'custom' && toDate) params.set('toDate', toDate);

    setSummaryLoading(true);
    axios.get(`${API_URL}/fund-transfer/usage-summary?${params.toString()}`)
      .then(res => {
        setUsageSummary(res.data.summary || []);
        setReportingPeriod(res.data.reportingPeriod || '');
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [dateFilter, selectedYear, selectedMonth, fromDate, toDate]);

  const fetchData = async () => {
    // Show cached data instantly for FSEs/TLs only (payments too large for localStorage)
    try {
      const cachedFSEs  = localStorage.getItem('admin_fses');
      const cachedTLs   = localStorage.getItem('admin_tls');
      if (cachedFSEs) setFses(JSON.parse(cachedFSEs));
      if (cachedTLs)  setTls(JSON.parse(cachedTLs));
      if (cachedFSEs) setLoading(false);
    } catch {}

    try {
      const [fseRes, tlRes, paymentsRes, formsRes] = await Promise.all([
        axios.get(`${API_URL}/fse`),
        axios.get(`${API_URL}/tl`),
        axios.get(`${API_URL}/fund-transfer`).catch(() => ({ data: { transfers: [] } })),
        axios.get(`${API_URL}/forms?limit=5000`).catch(() => ({ data: { forms: [] } }))
      ]);
      const fses    = fseRes.data.fses   || [];
      const tls     = tlRes.data.tls     || [];
      const allPayments = paymentsRes.data.transfers || [];
      const mkForms = (formsRes.data.forms || []).filter(f => f.formType === 'mobikwik-withdraw');
      setFses(fses);
      setTls(tls);
      setPayments(allPayments);
      setMobikwikForms(mkForms);
      // Only cache small data in localStorage
      try { localStorage.setItem('admin_fses', JSON.stringify(fses)); } catch {}
      try { localStorage.setItem('admin_tls',  JSON.stringify(tls));  } catch {}
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Bust summary cache and re-fetch — call after syncing new data (opening balances, BT sheets etc.)
  const handleBustCache = async () => {
    setBustingCache(true);
    try {
      await axios.post(`${API_URL}/fund-transfer/cache/bust`);
      // Also bust FSE/TL caches
      await axios.post(`${API_URL}/fse/cache/bust`).catch(() => {});
      // Re-trigger summary fetch by bumping a dummy param
      const params = new URLSearchParams();
      if (dateFilter) params.set('dateFilter', dateFilter);
      if (selectedYear) params.set('selectedYear', selectedYear);
      if (selectedMonth) params.set('selectedMonth', selectedMonth);
      if (dateFilter === 'custom' && fromDate) params.set('fromDate', fromDate);
      if (dateFilter === 'custom' && toDate) params.set('toDate', toDate);
      setSummaryLoading(true);
      const res = await axios.get(`${API_URL}/fund-transfer/usage-summary?${params.toString()}`);
      setUsageSummary(res.data.summary || []);
      setReportingPeriod(res.data.reportingPeriod || '');
    } catch (err) {
      console.error('Cache bust failed:', err);
    } finally {
      setBustingCache(false);
      setSummaryLoading(false);
    }
  };

  // Filter payments by date, TL, and FSE
  const filteredPayments = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return payments.filter(p => {
      const d = new Date(p.createdAt || p.paymentDoneOn);
      if (isNaN(d.getTime())) return true; // no date — always include
      if (dateFilter === 'today' && d < today) return false;
      if (dateFilter === 'month' && d < monthStart) return false;
      if (dateFilter === 'custom') {
        if (fromDate && d < new Date(fromDate)) return false;
        if (toDate && d > new Date(toDate + 'T23:59:59')) return false;
      }
      if (selectedYear && d.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth && MONTHS[d.getMonth()] !== selectedMonth) return false;
      
      // TL filter: show ONLY the selected TL's own received payments
      // AND FSE-type payments to FSEs who are directly under that TL in TideBT_Access
      if (selectedTlFilter) {
        const tlLower = selectedTlFilter.toLowerCase();
        const isTlType = (p.transferToWhom || '').toLowerCase().includes('tl') ||
                         (p.transferToWhom || '').toLowerCase().includes('manager');
        // Match TL's own received fund: must be TL/Mgr type AND transferTo contains TL name
        const isReceiverTL = isTlType && (p.transferTo || '').toLowerCase().includes(tlLower);
        // Match FSE-type payment to FSE directly under this TL
        const isFseType = !isTlType;
        const isReceiverFseUnderTL = isFseType && fses.some(f => 
          f.name === p.transferTo && 
          (f.reportingManager || '').toLowerCase() === tlLower
        );
        if (!isReceiverTL && !isReceiverFseUnderTL) return false;
      }

      // FSE filter: match FSE receiver directly
      if (selectedFseFilter && p.transferTo !== selectedFseFilter) return false;

      return true;
    });
  }, [payments, dateFilter, fromDate, toDate, selectedYear, selectedMonth, selectedTlFilter, selectedFseFilter, fses]);

  const totalAmount = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Filter Mobikwik withdrawals by date, TL, and FSE
  const filteredMobikwik = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return mobikwikForms.filter(f => {
      const d = new Date(f.createdAt || f.transactionDate);
      if (dateFilter === 'today' && d < today) return false;
      if (dateFilter === 'month' && d < monthStart) return false;
      if (dateFilter === 'custom') {
        if (fromDate && d < new Date(fromDate)) return false;
        if (toDate && d > new Date(toDate + 'T23:59:59')) return false;
      }
      if (selectedYear && d.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth && MONTHS[d.getMonth()] !== selectedMonth) return false;
      
      // TL filter: match TL directly OR FSE who reports to that TL
      if (selectedTlFilter) {
        const tlLower = selectedTlFilter.toLowerCase();
        const isFseUnderTL = fses.some(fs => fs.name === f.employeeName && 
          ((fs.reportingManager || '').toLowerCase().includes(tlLower)));
        const isTlMatch = (f.tl || '').toLowerCase().includes(tlLower) || 
                          tlLower.includes((f.tl || '').toLowerCase().split(' ')[0]);
        if (!isTlMatch && !isFseUnderTL) return false;
      }

      // FSE filter
      if (selectedFseFilter && f.employeeName !== selectedFseFilter && f.fse !== selectedFseFilter) return false;

      return true;
    });
  }, [mobikwikForms, dateFilter, fromDate, toDate, selectedYear, selectedMonth, selectedTlFilter, selectedFseFilter, fses]);

  const totalMobikwikAmount = filteredMobikwik.reduce((sum, f) => sum + (f.withdrawAmount || 0), 0);
  // eslint-disable-next-line no-unused-vars
  const totalMobikwikFees = Math.round(totalMobikwikAmount * 0.03 * 100) / 100;

  const filteredUsageSummary = useMemo(() => {
    return usageSummary.filter(item => {
      if (roleFilter === 'tl' && item.type !== "TL's & Managers") return false;
      if (roleFilter === 'fse' && item.type !== "FSE Ground Team") return false;
      
      // TL filter — EXACT match only (no includes/substring)
      // "Niteesh" filter must NOT match "Niteesh Kumar Saroj"
      if (selectedTlFilter) {
        const tlLower = selectedTlFilter.toLowerCase().trim();
        // TL row: exact name match
        const isTLMatch = (item.name || '').toLowerCase().trim() === tlLower;
        // FSE row: exact reportingManager match from TideBT_Access
        const isFseUnderTL = fses.some(f =>
          f.name === item.name &&
          (f.reportingManager || '').toLowerCase().trim() === tlLower
        );
        if (!isTLMatch && !isFseUnderTL) return false;
      }

      // FSE filter — exact match
      if (selectedFseFilter && item.name !== selectedFseFilter) return false;

      return true;
    });
  }, [usageSummary, roleFilter, selectedTlFilter, selectedFseFilter, fses]);

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!transferToWhom) { setError('Please select Transfer to Whom.'); return; }
      setStep(2);
    } else if (step === 2) {
      if (!senderName) { setError('Please select Sender Name.'); return; }
      if (!transferTo) { setError('Please select Transfer to.'); return; }
      if (!amount) { setError('Please enter Amount.'); return; }
      setStep(3);
    }
  };

  const handleBack = () => { setError(''); setStep(step - 1); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!paymentDoneOn) { setError('Please select Payment method.'); return; }

    const payload = {
      transferToWhom,
      senderName,
      transferTo,
      amount: parseFloat(amount),
      paymentDoneOn,
    };

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/fund-transfer`, payload);
      if (res.data.success) {
        setSuccess('✓ Payment recorded successfully!');
        handleClear();
        fetchData(); // Refresh list
      } else {
        setError(res.data.message || 'Submission failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setTransferToWhom(''); setSenderName(''); setTransferTo('');
    setAmount(''); setPaymentDoneOn(''); setStep(1); setError('');
  };

  // Get receiver list based on transferToWhom
  const receiverList = useMemo(() => {
    if (transferToWhom === "TL's & Managers") {
      return tls.map(tl => tl.name);
    } else {
      return fses.map(fse => fse.name);
    }
  }, [transferToWhom, fses, tls]);

  // Sender list (Admin and Accountant only)
  const senderList = useMemo(() => {
    return ['Admin', 'Accountant'];
  }, []);

  if (loading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress /></Box>;
  }

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight={700} gutterBottom>💰 BT Payment Tracker</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>For daily money tracking</Typography>

      <DateFilter
        dateFilter={dateFilter} setDateFilter={setDateFilter}
        fromDate={fromDate} setFromDate={setFromDate}
        toDate={toDate} setToDate={setToDate}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        selectedTlFilter={selectedTlFilter} setSelectedTlFilter={setSelectedTlFilter}
        selectedFseFilter={selectedFseFilter} setSelectedFseFilter={setSelectedFseFilter}
        tls={tls}
        fses={fses}
      />

      <Grid container spacing={3}>
        {/* Left: Form */}
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: 2, border: '1.5px solid #c8e6c9' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} mb={2}>New Payment</Typography>

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

              {/* Step indicator */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                {[1, 2, 3].map(s => (
                  <Box key={s} sx={{ flex: 1, height: 4, borderRadius: 4, bgcolor: step >= s ? '#1a5c38' : '#e0e0e0', transition: 'all 0.3s' }} />
                ))}
              </Box>

              <form onSubmit={handleSubmit}>
                {/* Step 1 */}
                {step === 1 && (
                  <TextField select fullWidth label="Transfer to Whom *" value={transferToWhom}
                    onChange={e => setTransferToWhom(e.target.value)} sx={{ mb: 2 }}>
                    <MenuItem value="">Choose</MenuItem>
                    <MenuItem value="TL's & Managers">TL's & Managers</MenuItem>
                    <MenuItem value="FSE Ground Team">FSE Ground Team</MenuItem>
                  </TextField>
                )}

                {/* Step 2 */}
                {step === 2 && (
                  <>
                    <TextField select fullWidth label="Sender Name *" value={senderName}
                      onChange={e => setSenderName(e.target.value)} sx={{ mb: 2 }}>
                      <MenuItem value="">Choose</MenuItem>
                      {senderList.map((name, i) => <MenuItem key={i} value={name}>{name}</MenuItem>)}
                    </TextField>

                    <Autocomplete
                      options={receiverList}
                      value={transferTo || null}
                      onChange={(_, val) => setTransferTo(val || '')}
                      renderInput={(params) => <TextField {...params} label="Transfer to *" fullWidth />}
                      size="small"
                      sx={{ mb: 2 }}
                      freeSolo
                    />

                    <TextField fullWidth type="number" label="Amount *" value={amount}
                      onChange={e => setAmount(e.target.value)} sx={{ mb: 2 }} />
                  </>
                )}

                {/* Step 3 */}
                {step === 3 && (
                  <TextField select fullWidth label="Payment done on *" value={paymentDoneOn}
                    onChange={e => setPaymentDoneOn(e.target.value)} sx={{ mb: 2 }}>
                    <MenuItem value="">Choose</MenuItem>
                    {transferToWhom === "TL's & Managers" ? (
                      [<MenuItem key="upi" value="UPI">UPI</MenuItem>,
                       <MenuItem key="cash" value="Cash">Cash</MenuItem>,
                       <MenuItem key="bank" value="Bank Transfer">Bank Transfer</MenuItem>,
                       <MenuItem key="cheque" value="Cheque">Cheque</MenuItem>]
                    ) : (
                      [<MenuItem key="qr" value="QR">QR</MenuItem>,
                       <MenuItem key="bank" value="Bank Account">Bank Account</MenuItem>,
                       <MenuItem key="upi" value="UPI">UPI</MenuItem>]
                    )}
                  </TextField>
                )}

                {/* Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {step > 1 && (
                      <Button variant="outlined" onClick={handleBack} sx={{ color: '#1a5c38', borderColor: '#1a5c38' }}>Back</Button>
                    )}
                    {step < 3 && (
                      <Button variant="contained" onClick={handleNext} sx={{ bgcolor: '#1a5c38', '&:hover': { bgcolor: '#0f3320' } }}>Next</Button>
                    )}
                    {step === 3 && (
                      <Button type="submit" variant="contained" disabled={submitting}
                        sx={{ bgcolor: '#4338ca', '&:hover': { bgcolor: '#3730a3' } }}>
                        {submitting ? 'Submitting...' : 'Submit'}
                      </Button>
                    )}
                  </Box>
                  <Button onClick={handleClear} sx={{ color: '#4338ca', fontWeight: 600 }}>Clear</Button>
                </Box>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Payment History */}
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: 2, border: '1.5px solid #e0e0e0' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
                <Typography variant="h6" fontWeight={700}>Payment History</Typography>
                <Chip label={`Total: ₹${totalAmount.toLocaleString()}`} sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700 }} />
              </Box>

              {filteredPayments.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={4}>No payments recorded yet</Typography>
              ) : (
                <TableContainer sx={{ maxHeight: 500 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' } }}>
                        <TableCell>#</TableCell>
                        <TableCell>Sender</TableCell>
                        <TableCell>Receiver</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredPayments.map((p, i) => {
                        const isReturn = (p.amount || 0) < 0;
                        return (
                        <TableRow key={i} hover sx={{ bgcolor: isReturn ? '#fff5f5' : 'inherit' }}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: isReturn ? '#c62828' : 'inherit' }}>
                            {isReturn ? p.transferTo : p.senderName || '-'}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, color: isReturn ? '#888' : 'inherit' }}>
                            {isReturn ? p.senderName : p.transferTo || '-'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={isReturn ? 'Return' : (p.transferToWhom === "TL's & Managers" ? 'TL/Mgr' : 'FSE')}
                              size="small"
                              sx={{
                                bgcolor: isReturn ? '#fdecea' : (p.transferToWhom === "TL's & Managers" ? '#e3f2fd' : '#e6f4ea'),
                                color:   isReturn ? '#c62828' : (p.transferToWhom === "TL's & Managers" ? '#1565c0' : '#2e7d32'),
                                fontWeight: 700, fontSize: 10
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: isReturn ? '#c62828' : '#2e7d32' }}>
                            {isReturn ? '↩ ' : ''}₹{Math.abs(p.amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>{p.paymentDoneOn || '-'}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Fund Usage Summary */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 2, border: '1.5px solid #e0e0e0', mt: 2 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
                <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
                  <Typography variant="h6" fontWeight={700}>📊 Fund Usage Summary</Typography>
                  <Chip
                    label={`Reporting Period: ${reportingPeriod || (selectedMonth || selectedYear ? `${selectedMonth} ${selectedYear}`.trim() : 'All Time')}`}
                    size="small"
                    sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 700, fontSize: 11, height: 22 }}
                  />
                  <Tooltip title="Refresh carry-forward data (after syncing opening balances)">
                    <IconButton
                      size="small"
                      onClick={handleBustCache}
                      disabled={bustingCache || summaryLoading}
                      sx={{ color: '#1a5c38', border: '1px solid #c8e6c9', borderRadius: 1.5, p: 0.5 }}
                    >
                      <RefreshIcon fontSize="small" sx={{ animation: bustingCache ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Tabs
                  value={roleFilter}
                  onChange={(e, val) => setRoleFilter(val)}
                  sx={{
                    minHeight: 32,
                    '& .MuiTab-root': { py: 0.5, px: 2, minHeight: 32, textTransform: 'capitalize', fontWeight: 700, fontSize: '0.85rem', color: '#666666', '&.Mui-selected': { color: '#1a5c38' } },
                    '& .MuiTabs-indicator': { bgcolor: '#1a5c38' }
                  }}
                >
                  <Tab label="All" value="all" />
                  <Tab label="TL's & Managers" value="tl" />
                  <Tab label="FSE Ground Team" value="fse" />
                </Tabs>
              </Box>

              {/* ── Carry Forward Alert Section ── */}
              {(() => {
                const withCarry = usageSummary.filter(item => (item.carryForward || 0) > 0);
                if (withCarry.length === 0) return null;
                const totalCarry = withCarry.reduce((s, item) => s + (item.carryForward || 0), 0);
                return (
                  <Box sx={{ mb: 2.5, p: 2, bgcolor: '#fff8e1', border: '1.5px solid #ffd54f', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                      <Typography fontWeight={800} fontSize={13} color="#e65100">
                        🔄 Carry Forward from Previous Month(s)
                      </Typography>
                      <Chip
                        label={`Total Pending: ₹${totalCarry.toLocaleString()}`}
                        size="small"
                        sx={{ bgcolor: '#ff9800', color: '#fff', fontWeight: 800, fontSize: 11 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {withCarry.map((item, i) => (
                        <Box key={i} sx={{
                          display: 'flex', alignItems: 'center', gap: 1,
                          bgcolor: '#fff3e0', border: '1px solid #ffb74d',
                          borderRadius: 2, px: 1.5, py: 0.8
                        }}>
                          <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: '#e65100', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 800 }}>
                            {item.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                          </Box>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography fontSize={11} fontWeight={700} color="#e65100">{item.name}</Typography>
                              <Chip
                                label={item.type === "TL's & Managers" ? 'TL' : 'FSE'}
                                size="small"
                                sx={{
                                  height: 14, fontSize: 8, fontWeight: 800, px: 0.3,
                                  bgcolor: item.type === "TL's & Managers" ? '#e3f2fd' : '#e8f5e9',
                                  color: item.type === "TL's & Managers" ? '#1565c0' : '#1a4731',
                                }}
                              />
                            </Box>
                            <Typography fontSize={10} color="#bf360c" fontWeight={600}>
                              ₹{(item.carryForward || 0).toLocaleString()} pending
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                    <Typography fontSize={10} color="text.secondary" mt={1}>
                      💡 These amounts were not used in previous period(s) and are carried forward to the current period.
                    </Typography>
                  </Box>
                );
              })()}

              {summaryLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" py={5}>
                  <CircularProgress size={32} sx={{ color: '#1a5c38' }} />
                  <Typography ml={2} color="text.secondary" fontSize={14}>Loading fund data...</Typography>
                </Box>
              ) : filteredUsageSummary.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={4}>No fund usage data yet</Typography>
              ) : (
                <Box>
                  {/* ── TL Fund Flow Cards ── */}
                  {filteredUsageSummary.filter(item => item.type === "TL's & Managers").length > 0 && roleFilter !== 'fse' && (
                    <Box mb={3}>
                      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, mb: 1.5, fontSize: 11 }}>
                        🏦 TL's & Managers — Fund Flow
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {filteredUsageSummary.filter(item => item.type === "TL's & Managers").map((item, i) => {
                          // selfKept = received - distributed to FSEs (NOT clamped — negative means TL returned fund)
                          const selfKept = item.received - (item.sentToFSEs || 0);
                          const fundLeft = item.fundLeft || 0;
                          const totalAvail = item.totalAvailable ?? selfKept;
                          return (
                            <Box key={i} sx={{ border: '1.5px solid #c8e6c9', borderRadius: 2, overflow: 'hidden' }}>
                              {/* Header */}
                              <Box sx={{ background: 'linear-gradient(135deg, #1a5c38 0%, #2d7a4f 100%)', px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 14 }}>
                                    {item.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </Box>
                                  <Box>
                                    <Typography fontWeight={700} color="#fff" fontSize={15}>{item.name}</Typography>
                                    <Typography fontSize={11} sx={{ color: 'rgba(255,255,255,0.75)' }}>Team Lead · {selectedMonth} {selectedYear}</Typography>
                                  </Box>
                                </Box>
                                <Chip
                                  label={fundLeft >= 0 ? `₹${fundLeft.toLocaleString(undefined, {maximumFractionDigits:0})} Left` : `₹${Math.abs(fundLeft).toLocaleString(undefined, {maximumFractionDigits:0})} Overdrawn`}
                                  sx={{ bgcolor: fundLeft >= 0 ? '#e3f2fd' : '#ffebee', color: fundLeft >= 0 ? '#1565c0' : '#c62828', fontWeight: 800, fontSize: 13 }}
                                />
                              </Box>

                              {/* Fund Flow Row */}
                              <Box sx={{ px: 2.5, py: 2, background: '#f8fdf9' }}>

                                {/* Row 1: This month activity */}
                                <Typography fontSize={9} fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={1} mb={0.75}>
                                  📅 This Month ({selectedMonth} {selectedYear})
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0, mb: 2, flexWrap: 'wrap' }}>
                                  <Box sx={{ flex: 1, minWidth: 110, background: item.received < 0 ? '#fdecea' : '#e8f5e9', borderRadius: '10px 0 0 10px', px: 2, py: 1.5, borderRight: '2px dashed #a5d6a7' }}>
                                    <Typography fontSize={9} color="text.secondary" fontWeight={600} textTransform="uppercase">
                                      {item.received < 0 ? 'Returned to Admin' : 'Received from VV'}
                                    </Typography>
                                    <Typography fontSize={18} fontWeight={800} color={item.received < 0 ? '#c62828' : '#2e7d32'}>₹{item.received.toLocaleString()}</Typography>
                                    {item.received < 0 && <Typography fontSize={8} sx={{ color: '#c62828', mt: 0.5 }}>Net return this month</Typography>}
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5, color: '#aaa', fontSize: 18 }}>→</Box>
                                  <Box sx={{ flex: 1, minWidth: 110, background: '#e3f2fd', px: 2, py: 1.5, borderRight: '2px dashed #90caf9' }}>
                                    <Typography fontSize={9} color="text.secondary" fontWeight={600} textTransform="uppercase">Distributed to FSEs</Typography>
                                    <Typography fontSize={18} fontWeight={800} color="#1565c0">₹{(item.sentToFSEs || 0).toLocaleString()}</Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5, color: '#aaa', fontSize: 18 }}>→</Box>
                                  <Box sx={{ flex: 1, minWidth: 110, background: selfKept < 0 ? '#fdecea' : '#fff8e1', borderRadius: '0 10px 10px 0', px: 2, py: 1.5 }}>
                                    <Typography fontSize={9} color="text.secondary" fontWeight={600} textTransform="uppercase">
                                      {selfKept < 0 ? 'Net Return (After Dist.)' : 'Kept for Self'}
                                    </Typography>
                                    <Typography fontSize={18} fontWeight={800} color={selfKept < 0 ? '#c62828' : '#f57f17'}>₹{selfKept.toLocaleString()}</Typography>
                                    <Typography fontSize={8} color="text.secondary">Received − Distributed</Typography>
                                  </Box>
                                </Box>

                                {/* Row 2: Personal fund breakdown */}
                                <Typography fontSize={9} fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={1} mb={0.75}>
                                  💰 Personal Fund (Kept for Self)
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 1 }}>
                                  <Box sx={{ background: selfKept < 0 ? '#fdecea' : '#fff8e1', border: `1px solid ${selfKept < 0 ? '#ef9a9a' : '#ffe082'}`, borderRadius: 1.5, px: 1.5, py: 1, textAlign: 'center' }}>
                                    <Typography fontSize={9} color="text.secondary" fontWeight={600} textTransform="uppercase">
                                      {selfKept < 0 ? 'Net Return' : 'Self Kept'}
                                    </Typography>
                                    <Typography fontSize={13} fontWeight={800} color={selfKept < 0 ? '#c62828' : '#f57f17'}>₹{selfKept.toLocaleString()}</Typography>
                                  </Box>
                                  <Box sx={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 1.5, px: 1.5, py: 1, textAlign: 'center' }}>
                                    <Typography fontSize={9} color="text.secondary" fontWeight={600} textTransform="uppercase">+ Carry Fwd</Typography>
                                    <Typography fontSize={13} fontWeight={800} color="#388e3c">₹{(item.carryForward || 0).toLocaleString()}</Typography>
                                    <Typography fontSize={8} color="text.secondary">From prev months</Typography>
                                  </Box>
                                  <Box sx={{ background: '#f1f8e9', border: '1.5px solid #66bb6a', borderRadius: 1.5, px: 1.5, py: 1, textAlign: 'center' }}>
                                    <Typography fontSize={9} color="text.secondary" fontWeight={600} textTransform="uppercase">= Available</Typography>
                                    <Typography fontSize={13} fontWeight={800} color="#1b5e20">₹{totalAvail.toLocaleString()}</Typography>
                                  </Box>
                                  <Box sx={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 1.5, px: 1.5, py: 1, textAlign: 'center' }}>
                                    <Typography fontSize={9} color="text.secondary" fontWeight={600} textTransform="uppercase">BT Done</Typography>
                                    <Typography fontSize={13} fontWeight={800} color="#e65100">₹{(item.usedBT || 0).toLocaleString()}</Typography>
                                  </Box>
                                  <Box sx={{ background: '#ede9fe', border: '1px solid #ce93d8', borderRadius: 1.5, px: 1.5, py: 1, textAlign: 'center' }}>
                                    <Typography fontSize={9} color="text.secondary" fontWeight={600} textTransform="uppercase">RP ({item.rpCount || 0}×₹2.5k)</Typography>
                                    <Typography fontSize={13} fontWeight={800} color="#7c3aed">₹{(item.usedRP || 0).toLocaleString()}</Typography>
                                  </Box>
                                  <Box sx={{ background: '#fce4ec', border: '1px solid #f48fb1', borderRadius: 1.5, px: 1.5, py: 1, textAlign: 'center' }}>
                                    <Typography fontSize={9} color="text.secondary" fontWeight={600} textTransform="uppercase">BT Fee 1.5%</Typography>
                                    <Typography fontSize={13} fontWeight={800} color="#c62828">₹{(item.btFee || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Typography>
                                  </Box>
                                  {item.withdrawAmount > 0 && (
                                    <Box sx={{ background: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: 1.5, px: 1.5, py: 1, textAlign: 'center' }}>
                                      <Typography fontSize={9} color="text.secondary" fontWeight={600} textTransform="uppercase">MobiKwik</Typography>
                                      <Typography fontSize={13} fontWeight={800} color="#4338ca">₹{item.withdrawAmount.toLocaleString()}</Typography>
                                    </Box>
                                  )}
                                  <Box sx={{ background: '#fff8e1', border: '1.5px solid #ffa726', borderRadius: 1.5, px: 1.5, py: 1, textAlign: 'center' }}>
                                    <Typography fontSize={9} color="text.secondary" fontWeight={600} textTransform="uppercase">Total Used</Typography>
                                    <Typography fontSize={13} fontWeight={800} color="#ff6f00">₹{(item.totalUsed || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Typography>
                                  </Box>
                                  <Box sx={{ background: fundLeft >= 0 ? '#e3f2fd' : '#ffebee', border: `1.5px solid ${fundLeft >= 0 ? '#1565c0' : '#c62828'}`, borderRadius: 1.5, px: 1.5, py: 1, textAlign: 'center' }}>
                                    <Typography fontSize={9} color="text.secondary" fontWeight={600} textTransform="uppercase">Fund Left</Typography>
                                    <Typography fontSize={13} fontWeight={800} color={fundLeft >= 0 ? '#1565c0' : '#c62828'}>
                                      ₹{Math.abs(fundLeft).toLocaleString(undefined, {maximumFractionDigits: 0})}
                                    </Typography>
                                    <Typography fontSize={8} color="text.secondary">{fundLeft >= 0 ? 'Available' : 'Overdrawn'}</Typography>
                                  </Box>
                                </Box>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  {/* ── FSE Table ── */}
                  {filteredUsageSummary.filter(item => item.type === "FSE Ground Team").length > 0 && roleFilter !== 'tl' && (
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, mb: 1.5, fontSize: 11 }}>
                        👥 FSE Ground Team
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary', bgcolor: '#f8fdf9' } }}>
                              <TableCell>Name</TableCell>
                              <TableCell align="center">Received</TableCell>
                              <TableCell align="center" sx={{ color: '#2e7d32' }}>Carry Fwd</TableCell>
                              <TableCell align="center" sx={{ color: '#1b5e20' }}>Total Avail</TableCell>
                              <TableCell align="center">BT Done</TableCell>
                              <TableCell align="center">RP #</TableCell>
                              <TableCell align="center">RP Cost</TableCell>
                              <TableCell align="center">BT Fee</TableCell>
                              <TableCell align="center">MK W.</TableCell>
                              <TableCell align="center">Total Used</TableCell>
                              <TableCell align="center">Fund Left</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {filteredUsageSummary.filter(item => item.type === "FSE Ground Team").map((item, i) => (
                              <TableRow key={i} hover>
                                <TableCell sx={{ fontWeight: 600 }}>{item.name}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, color: '#2e7d32' }}>₹{item.received?.toLocaleString()}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, color: '#388e3c' }}>₹{(item.carryForward || 0).toLocaleString()}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, color: '#1b5e20' }}>₹{(item.totalAvailable || 0).toLocaleString()}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, color: '#e65100' }}>₹{(item.usedBT || 0).toLocaleString()}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, color: '#0369a1' }}>{item.rpCount || 0}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, color: '#7c3aed' }}>₹{(item.usedRP || 0).toLocaleString()}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, color: '#c62828' }}>₹{(item.btFee || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, color: '#4338ca' }}>₹{(item.withdrawAmount || 0).toLocaleString()}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, color: '#ff6f00' }}>₹{(item.totalUsed || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, color: (item.fundLeft || 0) >= 0 ? '#1565c0' : '#c62828' }}>
                                  ₹{(item.fundLeft || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
