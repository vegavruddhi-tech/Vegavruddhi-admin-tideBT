import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Button, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress, Alert, Grid, Autocomplete, Tabs, Tab
} from '@mui/material';
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
    axios.get(`${API_URL}/fund-transfer/usage-summary?${params.toString()}`)
      .then(res => {
        setUsageSummary(res.data.summary || []);
        setReportingPeriod(res.data.reportingPeriod || '');
      })
      .catch(() => {});
  }, [dateFilter, selectedYear, selectedMonth, fromDate, toDate]);

  const fetchData = async () => {
    try {
      const [fseRes, tlRes, paymentsRes, formsRes] = await Promise.all([
        axios.get(`${API_URL}/fse`),
        axios.get(`${API_URL}/tl`),
        axios.get(`${API_URL}/fund-transfer`).catch(() => ({ data: { transfers: [] } })),
        axios.get(`${API_URL}/forms?limit=5000`).catch(() => ({ data: { forms: [] } }))
      ]);
      setFses(fseRes.data.fses || []);
      setTls(tlRes.data.tls || []);

      const allPayments = paymentsRes.data.transfers || [];
      setPayments(allPayments);
      const mkForms = (formsRes.data.forms || []).filter(f => f.formType === 'mobikwik-withdraw');
      setMobikwikForms(mkForms);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
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
      
      // TL filter: match TL receiver directly OR FSE receiver who reports to that TL
      if (selectedTlFilter) {
        const isReceiverTL = p.transferTo === selectedTlFilter;
        const isReceiverFseUnderTL = fses.some(f => f.name === p.transferTo && f.reportingManager === selectedTlFilter);
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
        const isFseUnderTL = fses.some(fs => fs.name === f.employeeName && fs.reportingManager === selectedTlFilter);
        if (f.tl !== selectedTlFilter && !isFseUnderTL) return false;
      }

      // FSE filter
      if (selectedFseFilter && f.employeeName !== selectedFseFilter && f.fse !== selectedFseFilter) return false;

      return true;
    });
  }, [mobikwikForms, dateFilter, fromDate, toDate, selectedYear, selectedMonth, selectedTlFilter, selectedFseFilter, fses]);

  const totalMobikwikAmount = filteredMobikwik.reduce((sum, f) => sum + (f.withdrawAmount || 0), 0);
  const totalMobikwikFees = Math.round(totalMobikwikAmount * 0.03 * 100) / 100;

  const filteredUsageSummary = useMemo(() => {
    return usageSummary.filter(item => {
      if (roleFilter === 'tl' && item.type !== "TL's & Managers") return false;
      if (roleFilter === 'fse' && item.type !== "FSE Ground Team") return false;
      
      // TL filter
      if (selectedTlFilter) {
        const isTL = item.name === selectedTlFilter;
        const isFseUnderTL = fses.some(f => f.name === item.name && f.reportingManager === selectedTlFilter);
        if (!isTL && !isFseUnderTL) return false;
      }

      // FSE filter
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
                      {filteredPayments.map((p, i) => (
                        <TableRow key={i} hover>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{p.senderName || '-'}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{p.transferTo || '-'}</TableCell>
                          <TableCell>
                            <Chip label={p.transferToWhom === "TL's & Managers" ? 'TL/Mgr' : 'FSE'} size="small"
                              sx={{ bgcolor: p.transferToWhom === "TL's & Managers" ? '#e3f2fd' : '#e6f4ea',
                                color: p.transferToWhom === "TL's & Managers" ? '#1565c0' : '#2e7d32', fontWeight: 700, fontSize: 10 }} />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#2e7d32' }}>₹{p.amount?.toLocaleString()}</TableCell>
                          <TableCell>{p.paymentDoneOn || '-'}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
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
                </Box>
                <Tabs
                  value={roleFilter}
                  onChange={(e, val) => setRoleFilter(val)}
                  sx={{
                    minHeight: 32,
                    '& .MuiTab-root': { 
                      py: 0.5, 
                      px: 2, 
                      minHeight: 32, 
                      textTransform: 'capitalize', 
                      fontWeight: 700, 
                      fontSize: '0.85rem',
                      color: '#666666',
                      '&.Mui-selected': { color: '#1a5c38' }
                    },
                    '& .MuiTabs-indicator': { bgcolor: '#1a5c38' }
                  }}
                >
                  <Tab label="All" value="all" />
                  <Tab label="TL's & Managers" value="tl" />
                  <Tab label="FSE Ground Team" value="fse" />
                </Tabs>
              </Box>

              {filteredUsageSummary.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={4}>No fund usage data yet</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' } }}>
                        <TableCell>Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="center">Received</TableCell>
                        <TableCell align="center" sx={{ color: '#2e7d32', fontWeight: 700 }}>Carry Fwd</TableCell>
                        <TableCell align="center" sx={{ color: '#1b5e20', fontWeight: 700 }}>Total Avail</TableCell>
                        {roleFilter !== 'fse' && <TableCell align="center">Sent to FSEs</TableCell>}
                        <TableCell align="center">Used (BT)</TableCell>
                        <TableCell align="center" sx={{ color: '#0369a1', fontWeight: 700 }}>RP#</TableCell>
                        <TableCell align="center">Used (RP)</TableCell>
                        <TableCell align="center">BT Fee</TableCell>
                        <TableCell align="center">MK W.draw</TableCell>
                        <TableCell align="center">MK W.Fee</TableCell>
                        <TableCell align="center">Total Used</TableCell>
                        <TableCell align="center">Fund Left</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredUsageSummary.map((item, i) => (
                        <TableRow key={i} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{item.name}</TableCell>
                          <TableCell>
                            <Chip label={item.type === "TL's & Managers" ? 'TL/Mgr' : 'FSE'} size="small"
                              sx={{ bgcolor: item.type === "TL's & Managers" ? '#e3f2fd' : '#e6f4ea',
                                color: item.type === "TL's & Managers" ? '#1565c0' : '#2e7d32', fontWeight: 700, fontSize: 10 }} />
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#2e7d32' }}>₹{item.received?.toLocaleString()}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#388e3c' }}>₹{(item.carryForward || 0).toLocaleString()}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#1b5e20' }}>₹{(item.totalAvailable || item.received || 0).toLocaleString()}</TableCell>
                          {roleFilter !== 'fse' && (
                            <TableCell align="center" sx={{ fontWeight: 700, color: '#0d47a1' }}>
                              {item.type === "TL's & Managers"
                                ? `₹${(item.sentToFSEs || 0).toLocaleString()}`
                                : <span style={{ color: '#bdbdbd' }}>—</span>}
                            </TableCell>
                          )}
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#e65100' }}>₹{item.usedBT?.toLocaleString()}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#0369a1' }}>{item.rpCount || 0}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#7c3aed' }}>₹{item.usedRP?.toLocaleString()}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#c62828' }}>₹{item.btFee?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#4338ca' }}>₹{item.withdrawAmount?.toLocaleString()}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#880e4f' }}>₹{item.withdrawFee?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#ff6f00' }}>₹{item.totalUsed?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: item.fundLeft >= 0 ? '#1565c0' : '#c62828' }}>₹{item.fundLeft?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
