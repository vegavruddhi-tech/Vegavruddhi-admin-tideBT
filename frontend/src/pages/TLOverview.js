import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Chip, Card, Avatar,
  Collapse, TextField, InputAdornment, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, MenuItem
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
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
  return <Chip label={status || '–'} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, fontSize: 11 }} />;
}

function CategoryChip({ category }) {
  const colors = {
    'Bike Rider':      { bg: '#e3f2fd', color: '#1565c0' },
    'Small Merchant':  { bg: '#f3e5f5', color: '#6a1b9a' },
    'Hawker':          { bg: '#fff3e0', color: '#e65100' },
    'Free Lancer':     { bg: '#e8f5e9', color: '#2e7d32' },
    'Teacher':         { bg: '#fce4ec', color: '#880e4f' },
    'Skill Employer':  { bg: '#e0f7fa', color: '#006064' },
  };
  const c = colors[category] || { bg: '#f5f5f5', color: '#555' };
  return <Chip label={category || '–'} size="small" sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: 11 }} />;
}

// ── FSE Group (nested inside TL card) ─────────────────────────
function FSEGroup({ fse, forms, onViewForm }) {
  const [expanded, setExpanded] = useState(false);
  const fseForms = forms.filter(f => f.employeeName === fse.name);

  return (
    <Box sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
      <Box onClick={() => setExpanded(p => !p)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1, cursor: 'pointer', bgcolor: '#f9fafb',
          '&:hover': { bgcolor: '#f0f7f3' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ bgcolor: '#1a5c38', width: 28, height: 28, fontSize: 11, fontWeight: 700 }}>
            {initials(fse.name)}
          </Avatar>
          <Typography fontWeight={600} fontSize={13}>{fse.name}</Typography>
          {fse.phone && <Typography variant="caption" color="text.secondary">· {fse.phone}</Typography>}
          {fse.email && <Typography variant="caption" color="text.secondary">· {fse.email}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={`${fseForms.length} forms`} size="small"
            sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 11 }} />
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Box>
      </Box>
      <Collapse in={expanded}>
        {fseForms.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ p: 2, display: 'block' }}>
            No forms submitted.
          </Typography>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' } }}>
                  <TableCell>Merchant</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Opinion</TableCell>
                  <TableCell>Onboarding</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="center">View</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fseForms.map((f, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{f.merchantName || '-'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{f.merchantNumber || '-'}</TableCell>
                    <TableCell><CategoryChip category={f.merchantCategory} /></TableCell>
                    <TableCell><StatusChip status={f.merchantOpinion} /></TableCell>
                    <TableCell><StatusChip status={f.onboardingStatus} /></TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '–'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => onViewForm(f)} sx={{ color: '#1a5c38' }}>
                        <VisibilityIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Collapse>
    </Box>
  );
}

// ── TL Card (collapsible, shows FSEs inside) ──────────────────
function TLCard({ tl, onViewForm, dateFilter, fromDate, toDate, selectedYear, selectedMonth }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fses, setFses] = useState([]);
  const [forms, setForms] = useState([]);

  const handleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && fses.length === 0) {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/tl/${encodeURIComponent(tl.name)}`);
        setFses(res.data.fses || []);
        setForms(res.data.forms || []);
      } catch (err) {
        console.error('Error loading TL details:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Apply date filter to forms
  const filteredForms = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return forms.filter(f => {
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
  }, [forms, dateFilter, fromDate, toDate, selectedYear, selectedMonth]);

  const totalOnboarded = filteredForms.filter(f => f.onboardingStatus === 'Completed').length;
  const totalNotInterested = filteredForms.filter(f => f.merchantOpinion === 'Not interested').length;

  return (
    <Card sx={{ mb: 2, border: '1.5px solid #c8e6c9', borderRadius: 2 }}>
      <Box onClick={handleExpand}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2.5, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: '#1a5c38', width: 36, height: 36, fontSize: 13, fontWeight: 700 }}>
            {initials(tl.name)}
          </Avatar>
          <Box>
            <Typography fontWeight={700}>{tl.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {tl.phone || ''}{tl.email ? ` · ${tl.email}` : ''}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={`${tl.fseCount} FSEs`} size="small"
            sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 700, fontSize: 11, border: '1px solid #1565c030' }} />
          {forms.length > 0 && (
            <>
              <Chip label={`${totalOnboarded} Onboarded`} size="small"
                sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 11, border: '1px solid #2e7d3230' }} />
              <Chip label={`${totalNotInterested} Rejected`} size="small"
                sx={{ bgcolor: '#fdecea', color: '#c62828', fontWeight: 700, fontSize: 11, border: '1px solid #c6282830' }} />
            </>
          )}
          <Chip label={`${filteredForms.length || '–'} forms`} size="small"
            sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 11, border: '1px solid #2e7d3230' }} />
          {expanded ? <ExpandLessIcon sx={{ color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2.5, pb: 2 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box>
          ) : fses.length === 0 ? (
            <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>No FSEs found under this TL.</Typography>
          ) : (
            fses.map(fse => (
              <FSEGroup key={fse.name} fse={fse} forms={filteredForms} onViewForm={onViewForm} />
            ))
          )}
        </Box>
      </Collapse>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function TLOverview() {
  const [tls, setTls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Date filters
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('');

  // Form detail dialog
  const [formDetailOpen, setFormDetailOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);

  useEffect(() => {
    fetchTLs();
  }, []);

  const fetchTLs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/tl`);
      setTls(res.data.tls || []);
    } catch (error) {
      console.error('Error fetching TLs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewForm = (form) => {
    setSelectedForm(form);
    setFormDetailOpen(true);
  };

  const filteredTLs = useMemo(() => {
    if (!search) return tls;
    const q = search.toLowerCase();
    return tls.filter(tl =>
      tl.name?.toLowerCase().includes(q) ||
      tl.phone?.includes(q) ||
      tl.email?.toLowerCase().includes(q)
    );
  }, [tls, search]);

  const totalFSEs = tls.reduce((sum, tl) => sum + (tl.fseCount || 0), 0);

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
            TL Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tls.length} Team Leaders · {totalFSEs} total FSEs
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={fetchTLs} variant="outlined"
          sx={{ color: '#1a5c38', borderColor: '#1a5c38', fontWeight: 700, '&:hover': { bgcolor: '#e6f4ea' } }}>
          Refresh
        </Button>
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
        fullWidth size="small"
        placeholder="Search TL by name, phone or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3, maxWidth: 400 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary' }} /></InputAdornment>
        }}
      />

      {/* TL Cards */}
      {filteredTLs.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 6, border: '1.5px dashed #c8e6c9' }}>
          <Typography color="text.secondary">No TLs found.</Typography>
        </Card>
      ) : (
        filteredTLs
          .sort((a, b) => (b.fseCount || 0) - (a.fseCount || 0))
          .map(tl => (
            <TLCard key={tl.name} tl={tl} onViewForm={handleViewForm}
              dateFilter={dateFilter} fromDate={fromDate} toDate={toDate}
              selectedYear={selectedYear} selectedMonth={selectedMonth} />
          ))
      )}

      {/* Form Detail Dialog */}
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
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Mobile</Typography>
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
              <Box sx={{ gridColumn: '1 / -1', borderBottom: '1px solid #eee' }} />
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Opinion</Typography>
                <Box mt={0.5}><StatusChip status={selectedForm.merchantOpinion} /></Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Onboarding</Typography>
                <Box mt={0.5}><StatusChip status={selectedForm.onboardingStatus} /></Box>
              </Box>
              <Box sx={{ gridColumn: '1 / -1', borderBottom: '1px solid #eee' }} />
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
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Date</Typography>
                <Typography variant="body2">
                  {selectedForm.createdAt ? new Date(selectedForm.createdAt).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : '-'}
                </Typography>
              </Box>
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
