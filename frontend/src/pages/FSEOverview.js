import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Chip, Card, CardContent,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, InputAdornment, Avatar, Button, Collapse, Tooltip, MenuItem
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import DateFilter from '../components/DateFilter';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function initials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function StatusChip({ status }) {
  const map = {
    'Ready For Onboarding': { bg: '#e6f4ea', color: '#2e7d32' },
    'Not interested':       { bg: '#fdecea', color: '#c62828' },
    'Completed':            { bg: '#e6f4ea', color: '#2e7d32' },
    'Pending/Hold':         { bg: '#fff3e0', color: '#e65100' },
  };
  const s = map[status] || { bg: '#f5f5f5', color: '#555' };
  return (
    <Chip label={status || '–'} size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, fontSize: 11 }} />
  );
}

function CategoryChip({ category }) {
  const colors = {
    'Bike Rider':      { bg: '#e3f2fd', color: '#1565c0' },
    'Small Merchant':  { bg: '#f3e5f5', color: '#6a1b9a' },
    'Hawker':          { bg: '#fff3e0', color: '#e65100' },
    'Free Lancer':     { bg: '#e8f5e9', color: '#2e7d32' },
    'Teacher':         { bg: '#fce4ec', color: '#880e4f' },
    'Skill Employer':  { bg: '#e0f7fa', color: '#006064' },
    'Others':          { bg: '#f5f5f5', color: '#555' },
  };
  const c = colors[category] || { bg: '#f5f5f5', color: '#555' };
  return (
    <Chip label={category || '–'} size="small"
      sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: 11, border: `1px solid ${c.color}30` }} />
  );
}

// ── Employee Group (collapsible card per FSE) ─────────────────
function EmployeeGroup({ fse, forms, onViewForm }) {
  const [expanded, setExpanded] = useState(false);

  const onboarded = forms.filter(f => f.onboardingStatus === 'Completed').length;
  const pending = forms.filter(f => f.onboardingStatus === 'Pending/Hold').length;
  const readyCount = forms.filter(f => f.merchantOpinion === 'Ready For Onboarding').length;
  const notInterested = forms.filter(f => f.merchantOpinion === 'Not interested').length;

  return (
    <Card sx={{ mb: 2, border: '1.5px solid #c8e6c9', borderRadius: 2 }}>
      {/* HEADER */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
          borderRadius: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: '#1a5c38' }}>{initials(fse.name)}</Avatar>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography fontWeight={700}>{fse.name}</Typography>
              {fse.phone && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  · {fse.phone}
                </Typography>
              )}
            </Box>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              {forms.length} merchant{forms.length !== 1 ? 's' : ''}
              {fse.reportingManager && ` · TL: ${fse.reportingManager}`}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {forms.length > 0 && (
            <>
              <Chip label={`${onboarded} Onboarded`} size="small"
                sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 11, border: '1px solid #2e7d3230' }} />
              <Chip label={`${pending} Pending`} size="small"
                sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: 11, border: '1px solid #e6510030' }} />
              <Chip label={`${notInterested} Rejected`} size="small"
                sx={{ bgcolor: '#fdecea', color: '#c62828', fontWeight: 700, fontSize: 11, border: '1px solid #c6282830' }} />
            </>
          )}
          <Chip label={`${forms.length} forms`} size="small"
            sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 700, fontSize: 11, border: '1px solid #1565c030' }} />
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>
      </Box>

      {/* TABLE */}
      <Collapse in={expanded}>
        {/* Summary chips */}
        <Box sx={{ px: 2.5, py: 1, bgcolor: '#f9fffe', borderTop: '1px solid #e0e0e0', display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mr: 1 }}>
            Summary:
          </Typography>
          <Chip label={`Total: ${forms.length}`} size="small" sx={{ fontWeight: 700, fontSize: 11 }} />
          <Chip label={`Ready: ${readyCount}`} size="small" sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 11 }} />
          <Chip label={`Onboarded: ${onboarded}`} size="small" sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 700, fontSize: 11 }} />
          <Chip label={`Pending: ${pending}`} size="small" sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: 11 }} />
          <Chip label={`Not Interested: ${notInterested}`} size="small" sx={{ bgcolor: '#fdecea', color: '#c62828', fontWeight: 700, fontSize: 11 }} />
        </Box>

        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary', bgcolor: '#f5f5f5' } }}>
                <TableCell>Merchant Name</TableCell>
                <TableCell>Mobile</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Opinion</TableCell>
                <TableCell>Onboarding</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="center">View</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {forms.map((form, i) => (
                <TableRow key={i} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{form.merchantName || '-'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{form.merchantNumber || '-'}</TableCell>
                  <TableCell><CategoryChip category={form.merchantCategory} /></TableCell>
                  <TableCell><StatusChip status={form.merchantOpinion} /></TableCell>
                  <TableCell><StatusChip status={form.onboardingStatus} /></TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {form.createdAt ? new Date(form.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View full details">
                      <IconButton size="small" onClick={() => onViewForm(form)}
                        sx={{ color: '#1a5c38', '&:hover': { bgcolor: '#e6f4ea' } }}>
                        <VisibilityIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Collapse>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function FSEOverview() {
  const [fses, setFses] = useState([]);
  const [allForms, setAllForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Date filters
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('');

  // Merchant form detail dialog
  const [formDetailOpen, setFormDetailOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fseRes, formsRes] = await Promise.all([
        axios.get(`${API_URL}/fse`),
        axios.get(`${API_URL}/forms?limit=5000`)
      ]);
      setFses(fseRes.data.fses || []);
      setAllForms(formsRes.data.forms || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewForm = (form) => {
    setSelectedForm(form);
    setFormDetailOpen(true);
  };

  // Group forms by employee name (with date filter applied)
  const groupedByEmployee = useMemo(() => {
    // Apply date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const filtered = allForms.filter(form => {
      const d = new Date(form.createdAt);
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

    const groups = {};
    filtered.forEach(form => {
      const emp = form.employeeName || 'Unknown';
      if (!groups[emp]) groups[emp] = [];
      groups[emp].push(form);
    });
    return groups;
  }, [allForms, dateFilter, fromDate, toDate, selectedYear, selectedMonth]);

  // Filter FSEs based on search
  const filteredFSEs = useMemo(() => {
    if (!search) return fses;
    return fses.filter(fse =>
      fse.name?.toLowerCase().includes(search.toLowerCase()) ||
      fse.reportingManager?.toLowerCase().includes(search.toLowerCase())
    );
  }, [fses, search]);

  // Also filter forms if search matches merchant name/phone
  const filteredGroups = useMemo(() => {
    if (!search) return groupedByEmployee;
    
    // Filter: show FSEs whose name matches OR who have forms matching the search
    const result = {};
    Object.entries(groupedByEmployee).forEach(([empName, forms]) => {
      const fseMatch = empName.toLowerCase().includes(search.toLowerCase());
      const formMatch = forms.some(f => 
        f.merchantName?.toLowerCase().includes(search.toLowerCase()) ||
        f.merchantNumber?.includes(search)
      );
      if (fseMatch || formMatch) {
        result[empName] = fseMatch ? forms : forms.filter(f =>
          f.merchantName?.toLowerCase().includes(search.toLowerCase()) ||
          f.merchantNumber?.includes(search)
        );
      }
    });
    return result;
  }, [groupedByEmployee, search]);

  // Compute overall KPIs from filtered forms
  const filteredFormsList = useMemo(() => Object.values(groupedByEmployee).flat(), [groupedByEmployee]);
  const totalOnboarded = filteredFormsList.filter(f => f.onboardingStatus === 'Completed').length;
  const totalPending = filteredFormsList.filter(f => f.onboardingStatus === 'Pending/Hold').length;
  const totalNotInterested = filteredFormsList.filter(f => f.merchantOpinion === 'Not interested').length;
  const totalReady = filteredFormsList.filter(f => f.merchantOpinion === 'Ready For Onboarding').length;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress sx={{ color: '#1a5c38' }} />
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#1a5c38' }}>
            FSE Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {fses.length} FSEs · {allForms.length} total merchant forms
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={fetchData} variant="outlined"
          sx={{ color: '#1a5c38', borderColor: '#1a5c38', fontWeight: 700, '&:hover': { bgcolor: '#e6f4ea' } }}>
          Refresh
        </Button>
      </Box>

      {/* KPIs */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #1565c030', borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="h4" fontWeight={800} color="#1565c0">{filteredFormsList.length}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Forms</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #2e7d3230', borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="h4" fontWeight={800} color="#2e7d32">{totalOnboarded}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Onboarded</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #ed6c0230', borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="h4" fontWeight={800} color="#ed6c02">{totalPending}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>On Hold</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #c6282830', borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="h4" fontWeight={800} color="#c62828">{totalNotInterested}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Not Interested</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #6a1b9a30', borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="h4" fontWeight={800} color="#6a1b9a">{totalReady}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Ready for Onboarding</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Date Filter */}
      <DateFilter
        dateFilter={dateFilter} setDateFilter={setDateFilter}
        fromDate={fromDate} setFromDate={setFromDate}
        toDate={toDate} setToDate={setToDate}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
      />

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search by FSE name, TL, merchant name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3, maxWidth: 500 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary' }} /></InputAdornment>
        }}
      />

      {/* Employee Groups */}
      {Object.keys(filteredGroups).length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 6, border: '1.5px dashed #c8e6c9' }}>
          <Typography color="text.secondary">No merchant forms found.</Typography>
        </Card>
      ) : (
        Object.entries(filteredGroups)
          .sort((a, b) => b[1].length - a[1].length) // Sort by form count desc
          .map(([empName, forms]) => {
            const fse = fses.find(f => f.name === empName) || { name: empName };
            return (
              <EmployeeGroup
                key={empName}
                fse={fse}
                forms={forms}
                onViewForm={handleViewForm}
              />
            );
          })
      )}

      {/* Merchant Form Detail Dialog */}
      <Dialog open={formDetailOpen} onClose={() => setFormDetailOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <Box sx={{ background: 'linear-gradient(135deg, #1a5c38dd, #1a5c3888)', px: 3, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, letterSpacing: 1.5 }}>
              MERCHANT DETAILS
            </Typography>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800 }}>
              {selectedForm?.merchantName}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>
              FSE: {selectedForm?.employeeName}
            </Typography>
          </Box>
          <IconButton onClick={() => setFormDetailOpen(false)} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 3 }}>
          {selectedForm && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Merchant Name</Typography>
                <Typography variant="body1" fontWeight={700}>{selectedForm.merchantName || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Mobile Number</Typography>
                <Typography variant="body1" fontWeight={700} sx={{ fontFamily: 'monospace' }}>{selectedForm.merchantNumber || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Email</Typography>
                <Typography variant="body2">{selectedForm.merchantEmailId || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Category</Typography>
                <Box mt={0.5}><CategoryChip category={selectedForm.merchantCategory} /></Box>
              </Box>

              <Box sx={{ gridColumn: '1 / -1', borderBottom: '1px solid #eee', my: 0.5 }} />

              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Merchant Opinion</Typography>
                <Box mt={0.5}><StatusChip status={selectedForm.merchantOpinion} /></Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Onboarding Status</Typography>
                <Box mt={0.5}><StatusChip status={selectedForm.onboardingStatus} /></Box>
              </Box>

              <Box sx={{ gridColumn: '1 / -1', borderBottom: '1px solid #eee', my: 0.5 }} />

              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Submitted By</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: '#1a5c38' }}>
                    {initials(selectedForm.employeeName)}
                  </Avatar>
                  <Typography variant="body2" fontWeight={600}>{selectedForm.employeeName || '-'}</Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Date & Time</Typography>
                <Typography variant="body2">
                  {selectedForm.createdAt ? new Date(selectedForm.createdAt).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : '-'}
                </Typography>
              </Box>
              {selectedForm.location && (
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Location</Typography>
                  <Typography variant="body2">
                    {selectedForm.location.latitude}, {selectedForm.location.longitude}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormDetailOpen(false)} sx={{ color: '#1a5c38', fontWeight: 700 }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
