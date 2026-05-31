import React, { useState, useEffect, useMemo } from 'react';
import { 
  Grid, Card, CardContent, Typography, Box, CircularProgress,
  Dialog, DialogTitle, DialogContent, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PeopleIcon from '@mui/icons-material/People';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DateFilter from '../components/DateFilter';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line, LabelList
} from 'recharts';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const PIE_COLORS = ['#2e7d32', '#ed6c02', '#c62828', '#1565c0'];

export default function Dashboard() {
  const [allForms, setAllForms] = useState([]);
  const [fses, setFses] = useState([]);
  const [tls, setTls] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date filters
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogData, setDialogData] = useState([]);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogType, setDialogType] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [fseRes, tlRes, formsRes] = await Promise.all([
        axios.get(`${API_URL}/fse`),
        axios.get(`${API_URL}/tl`),
        axios.get(`${API_URL}/forms?limit=5000`)
      ]);
      setFses(fseRes.data.fses || []);
      setTls(tlRes.data.tls || []);
      setAllForms(formsRes.data.forms || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Apply date filter
  const filteredForms = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return allForms.filter(f => {
      const d = new Date(f.createdAt);
      if (dateFilter === 'today' && d < today) return false;
      if (dateFilter === 'month' && d < monthStart) return false;
      if (dateFilter === 'custom') {
        if (fromDate && d < new Date(fromDate)) return false;
        if (toDate && d > new Date(toDate + 'T23:59:59')) return false;
      }
      if (selectedYear && d.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth && d.toLocaleString('en-US', { month: 'long' }) !== selectedMonth) return false;
      return true;
    });
  }, [allForms, dateFilter, fromDate, toDate, selectedYear, selectedMonth]);

  // KPI stats
  const stats = useMemo(() => ({
    totalFSEs: fses.length,
    totalTLs: tls.length,
    totalForms: filteredForms.length,
    onboarded: filteredForms.filter(f => f.onboardingStatus === 'Completed').length,
    pending: filteredForms.filter(f => f.onboardingStatus === 'Pending/Hold').length,
    notInterested: filteredForms.filter(f => f.merchantOpinion === 'Not interested').length,
    pendingTransfers: 0
  }), [fses, tls, filteredForms]);

  // Chart 1: Forms per FSE (top 15)
  const formsPerFSE = useMemo(() => {
    const counts = {};
    filteredForms.forEach(f => {
      const emp = f.employeeName || 'Unknown';
      counts[emp] = (counts[emp] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name: name.split(' ')[0], fullName: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [filteredForms]);

  // Chart 2: Onboarding status pie
  const onboardingPie = useMemo(() => {
    const onboarded = filteredForms.filter(f => f.onboardingStatus === 'Completed').length;
    const pending = filteredForms.filter(f => f.onboardingStatus === 'Pending/Hold').length;
    const notInterested = filteredForms.filter(f => f.merchantOpinion === 'Not interested').length;
    const ready = filteredForms.filter(f => f.merchantOpinion === 'Ready For Onboarding' && f.onboardingStatus !== 'Completed').length;
    return [
      { name: 'Onboarded', value: onboarded },
      { name: 'On Hold', value: pending },
      { name: 'Not Interested', value: notInterested },
      { name: 'Ready', value: ready },
    ].filter(d => d.value > 0);
  }, [filteredForms]);

  // Chart 3: Daily form submissions (last 30 days)
  const dailyTrend = useMemo(() => {
    const days = {};
    const now = new Date();
    // Create last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      days[key] = 0;
    }
    filteredForms.forEach(f => {
      const d = new Date(f.createdAt);
      const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      if (days[key] !== undefined) days[key]++;
    });
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [filteredForms]);

  // Chart 4: Forms per TL
  const formsPerTL = useMemo(() => {
    // Map FSE to TL
    const fseToTL = {};
    fses.forEach(fse => { if (fse.reportingManager) fseToTL[fse.name] = fse.reportingManager; });

    const counts = {};
    filteredForms.forEach(f => {
      const tl = fseToTL[f.employeeName] || 'Unknown';
      counts[tl] = (counts[tl] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredForms, fses]);

  // Chart 6: Top 10 FSEs by onboarding
  const topOnboarding = useMemo(() => {
    const counts = {};
    filteredForms.filter(f => f.onboardingStatus === 'Completed').forEach(f => {
      const emp = f.employeeName || 'Unknown';
      counts[emp] = (counts[emp] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name: name.split(' ')[0], fullName: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredForms]);

  // Handle chart bar/pie click
  const handleChartClick = (type, data) => {
    setDialogOpen(true);
    setDialogLoading(false);
    
    if (type === 'fseBar') {
      const fseName = data.fullName || data.name;
      setDialogTitle(`Forms by ${fseName}`);
      setDialogType('forms');
      setDialogData(filteredForms.filter(f => f.employeeName === fseName));
    } else if (type === 'tlBar') {
      const tlName = data.name;
      setDialogTitle(`Forms under TL: ${tlName}`);
      setDialogType('forms');
      const fseToTL = {};
      fses.forEach(fse => { if (fse.reportingManager) fseToTL[fse.name] = fse.reportingManager; });
      setDialogData(filteredForms.filter(f => fseToTL[f.employeeName] === tlName));
    } else if (type === 'onboardingPie') {
      const segment = data.name;
      setDialogTitle(`${segment} Merchants`);
      setDialogType('forms');
      if (segment === 'Onboarded') setDialogData(filteredForms.filter(f => f.onboardingStatus === 'Completed'));
      else if (segment === 'On Hold') setDialogData(filteredForms.filter(f => f.onboardingStatus === 'Pending/Hold'));
      else if (segment === 'Not Interested') setDialogData(filteredForms.filter(f => f.merchantOpinion === 'Not interested'));
      else if (segment === 'Ready') setDialogData(filteredForms.filter(f => f.merchantOpinion === 'Ready For Onboarding' && f.onboardingStatus !== 'Completed'));
      else setDialogData([]);
    } else if (type === 'onboardingBar') {
      const fseName = data.fullName || data.name;
      setDialogTitle(`Onboarded by ${fseName}`);
      setDialogType('forms');
      setDialogData(filteredForms.filter(f => f.employeeName === fseName && f.onboardingStatus === 'Completed'));
    } else if (type === 'dailyLine') {
      const dateStr = data.date;
      setDialogTitle(`Forms on ${dateStr}`);
      setDialogType('forms');
      setDialogData(filteredForms.filter(f => {
        const d = new Date(f.createdAt);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) === dateStr;
      }));
    }
  };

  const handleCardClick = async (type) => {
    setDialogOpen(true);
    setDialogLoading(false);
    setDialogType(type);

    if (type === 'fse') {
      setDialogTitle('All FSEs');
      setDialogData(fses);
    } else if (type === 'tl') {
      setDialogTitle('All Team Leaders');
      setDialogData(tls);
    } else if (type === 'forms') {
      setDialogTitle('All Forms');
      setDialogData(filteredForms.slice(0, 50));
    } else if (type === 'onboarded') {
      setDialogTitle('Onboarded Merchants');
      setDialogData(filteredForms.filter(f => f.onboardingStatus === 'Completed'));
    } else if (type === 'pending') {
      setDialogTitle('On Hold Merchants');
      setDialogData(filteredForms.filter(f => f.onboardingStatus === 'Pending/Hold'));
    } else if (type === 'notInterested') {
      setDialogTitle('Not Interested Merchants');
      setDialogData(filteredForms.filter(f => f.merchantOpinion === 'Not interested'));
    } else if (type === 'transfers') {
      setDialogTitle('Pending Transfers');
      setDialogData([]);
    }
  };

  const renderDialogContent = () => {
    if (dialogLoading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;
    if (dialogData.length === 0) return <Typography color="text.secondary" textAlign="center" py={4}>No data available</Typography>;

    if (dialogType === 'fse') {
      return (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Reporting TL</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {dialogData.map((fse, i) => (
                <TableRow key={i} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{fse.name}</TableCell>
                  <TableCell>{fse.phone || '-'}</TableCell>
                  <TableCell>{fse.reportingManager || '-'}</TableCell>
                  <TableCell><Chip label="active" size="small" color="success" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      );
    }
    if (dialogType === 'tl') {
      return (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>FSE Count</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {dialogData.map((tl, i) => (
                <TableRow key={i} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{tl.name}</TableCell>
                  <TableCell><Chip label={tl.fseCount} size="small" color="primary" /></TableCell>
                  <TableCell><Chip label="active" size="small" color="success" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      );
    }
    // Forms, onboarded, pending, notInterested all show merchant form table
    if (['forms', 'onboarded', 'pending', 'notInterested'].includes(dialogType)) {
      return (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>FSE</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Merchant</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Mobile</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Opinion</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Onboarding</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {dialogData.map((form, i) => (
                <TableRow key={i} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{form.employeeName || '-'}</TableCell>
                  <TableCell>{form.merchantName || '-'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{form.merchantNumber || '-'}</TableCell>
                  <TableCell><Chip label={form.merchantCategory || '-'} size="small" /></TableCell>
                  <TableCell>
                    <Chip label={form.merchantOpinion || '-'} size="small"
                      sx={{ bgcolor: form.merchantOpinion === 'Ready For Onboarding' ? '#e6f4ea' : form.merchantOpinion === 'Not interested' ? '#fdecea' : '#f5f5f5',
                        color: form.merchantOpinion === 'Ready For Onboarding' ? '#2e7d32' : form.merchantOpinion === 'Not interested' ? '#c62828' : '#555',
                        fontWeight: 600, fontSize: 11 }} />
                  </TableCell>
                  <TableCell>
                    <Chip label={form.onboardingStatus || 'N/A'} size="small"
                      sx={{ bgcolor: form.onboardingStatus === 'Completed' ? '#e6f4ea' : form.onboardingStatus === 'Pending/Hold' ? '#fff3e0' : '#f5f5f5',
                        color: form.onboardingStatus === 'Completed' ? '#2e7d32' : form.onboardingStatus === 'Pending/Hold' ? '#e65100' : '#555',
                        fontWeight: 600, fontSize: 11 }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{form.createdAt ? new Date(form.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      );
    }
    return null;
  };

  const statCards = [
    { title: 'Total FSEs', value: stats.totalFSEs, icon: <PeopleIcon />, color: '#1976d2', type: 'fse' },
    { title: 'Total TLs', value: stats.totalTLs, icon: <SupervisorAccountIcon />, color: '#2e7d32', type: 'tl' },
    { title: 'Total Forms', value: stats.totalForms, icon: <DescriptionIcon />, color: '#ed6c02', type: 'forms' },
    { title: 'Onboarded', value: stats.onboarded, icon: <DescriptionIcon />, color: '#00897b', type: 'onboarded' },
    { title: 'On Hold', value: stats.pending, icon: <DescriptionIcon />, color: '#f4511e', type: 'pending' },
    { title: 'Not Interested', value: stats.notInterested, icon: <DescriptionIcon />, color: '#c62828', type: 'notInterested' },
    { title: 'Pending Transfers', value: stats.pendingTransfers, icon: <AccountBalanceIcon />, color: '#9c27b0', type: 'transfers' },
  ];

  if (loading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress /></Box>;
  }

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight={700} gutterBottom>Dashboard</Typography>

      <DateFilter
        dateFilter={dateFilter} setDateFilter={setDateFilter}
        fromDate={fromDate} setFromDate={setFromDate}
        toDate={toDate} setToDate={setToDate}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
      />

      {/* KPI Cards */}
      <Grid container spacing={2} mb={3}>
        {statCards.map((card, index) => (
          <Grid item xs={6} sm={4} md key={index}>
            <Card
              sx={{
                bgcolor: card.color, color: 'white', cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 6px 20px rgba(0,0,0,0.25)' }
              }}
              onClick={() => handleCardClick(card.type)}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h5" fontWeight={800}>{card.value}</Typography>
                    <Typography variant="caption">{card.title}</Typography>
                  </Box>
                  <Box sx={{ opacity: 0.7 }}>{card.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts Row 1 */}
      <Grid container spacing={3} mb={3}>
        {/* Chart 1: Forms per FSE */}
        <Grid item xs={12} md={8}>
          <Card sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Forms per FSE</Typography>
            {formsPerFSE.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No data</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={formsPerFSE} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip formatter={(value, name, props) => [value, props.payload.fullName]} />
                  <Bar dataKey="count" fill="#1976d2" radius={[4, 4, 0, 0]} cursor="pointer"
                    onClick={(data) => handleChartClick('fseBar', data)}>
                    <LabelList dataKey="count" position="top" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Grid>

        {/* Chart 2: Onboarding Pie */}
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Onboarding Status</Typography>
            {onboardingPie.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No data</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={onboardingPie} cx="50%" cy="50%" outerRadius={100} dataKey="value" 
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false}
                    cursor="pointer" onClick={(_, index) => handleChartClick('onboardingPie', onboardingPie[index])}>
                    {onboardingPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row 2 */}
      <Grid container spacing={3} mb={3}>
        {/* Chart 3: Daily Trend */}
        <Grid item xs={12}>
          <Card sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Daily Form Submissions (Last 30 Days)</Typography>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={10} interval={2} />
                <YAxis allowDecimals={false} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="count" stroke="#1a5c38" strokeWidth={2} 
                  dot={{ r: 3, cursor: 'pointer' }} activeDot={{ r: 6, cursor: 'pointer', onClick: (e, payload) => handleChartClick('dailyLine', payload.payload) }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row 3 */}
      <Grid container spacing={3}>
        {/* Chart 4: Forms per TL */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Forms per TL</Typography>
            {formsPerTL.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No data</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={formsPerTL} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" fontSize={12} width={80} />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#2e7d32" radius={[0, 4, 4, 0]} cursor="pointer"
                    onClick={(data) => handleChartClick('tlBar', data)}>
                    <LabelList dataKey="count" position="right" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Grid>

        {/* Chart 6: Top 10 FSEs by Onboarding */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Top FSEs by Onboarding</Typography>
            {topOnboarding.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No onboarding data</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topOnboarding} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" fontSize={12} width={80} />
                  <RechartsTooltip formatter={(value, name, props) => [value, props.payload.fullName]} />
                  <Bar dataKey="count" fill="#00897b" radius={[0, 4, 4, 0]} cursor="pointer"
                    onClick={(data) => handleChartClick('onboardingBar', data)}>
                    <LabelList dataKey="count" position="right" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={700}>{dialogTitle}</Typography>
          <IconButton onClick={() => setDialogOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>{renderDialogContent()}</DialogContent>
      </Dialog>
    </Box>
  );
}
