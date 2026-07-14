import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Chip, Card, CardContent,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, InputAdornment, Avatar, Button, Collapse, Tooltip,
  ToggleButton, ToggleButtonGroup
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VisibilityIcon from '@mui/icons-material/Visibility'; // eslint-disable-line no-unused-vars
import RefreshIcon from '@mui/icons-material/Refresh';
import StorefrontIcon from '@mui/icons-material/Storefront'; // eslint-disable-line no-unused-vars
import ListAltIcon from '@mui/icons-material/ListAlt';
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
    'Mobikwik':        { bg: '#f3e8ff', color: '#7e22ce' },
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

  const isMobikwikOnly = forms.length > 0 && forms.every(f => f.formType === 'mobikwik-withdraw');

  const onboarded = forms.filter(f => f.onboardingStatus === 'Completed').length;
  const pending = forms.filter(f => f.onboardingStatus === 'Pending/Hold').length;
  const readyCount = forms.filter(f => f.merchantOpinion === 'Ready For Onboarding').length;
  const notInterested = forms.filter(f => f.merchantOpinion === 'Not interested').length;

  const withdrawAmount = forms.reduce((s, f) => s + (f.withdrawAmount || 0), 0);
  const withdrawFees = Math.round(withdrawAmount * 0.03 * 100) / 100;

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
          <Avatar sx={{ bgcolor: isMobikwikOnly ? '#7e22ce' : '#1a5c38' }}>{initials(fse.name)}</Avatar>
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
              {forms.length} record{forms.length !== 1 ? 's' : ''}
              {fse.reportingManager && ` · TL: ${fse.reportingManager}`}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {forms.length > 0 && (
            <>
              {isMobikwikOnly ? (
                <>
                  <Chip label={`Withdrawal: ₹${withdrawAmount.toLocaleString()}`} size="small"
                    sx={{ bgcolor: '#f3e8ff', color: '#7e22ce', fontWeight: 700, fontSize: 11, border: '1px solid #7e22ce30' }} />
                  <Chip label={`Fees: ₹${withdrawFees.toLocaleString()}`} size="small"
                    sx={{ bgcolor: '#fff5f5', color: '#c62828', fontWeight: 700, fontSize: 11, border: '1px solid #c6282830' }} />
                </>
              ) : (
                <>
                  <Chip label={`${onboarded} Onboarded`} size="small"
                    sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 11, border: '1px solid #2e7d3230' }} />
                  <Chip label={`${pending} Pending`} size="small"
                    sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: 11, border: '1px solid #e6510030' }} />
                  <Chip label={`${notInterested} Rejected`} size="small"
                    sx={{ bgcolor: '#fdecea', color: '#c62828', fontWeight: 700, fontSize: 11, border: '1px solid #c6282830' }} />
                </>
              )}
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
          {isMobikwikOnly ? (
            <>
              <Chip label={`Total Withdraw: ₹${withdrawAmount.toLocaleString()}`} size="small" sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 11 }} />
              <Chip label={`Total Fees: ₹${withdrawFees.toLocaleString()}`} size="small" sx={{ bgcolor: '#fdecea', color: '#c62828', fontWeight: 700, fontSize: 11 }} />
            </>
          ) : (
            <>
              <Chip label={`Ready: ${readyCount}`} size="small" sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 11 }} />
              <Chip label={`Onboarded: ${onboarded}`} size="small" sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 700, fontSize: 11 }} />
              <Chip label={`Pending: ${pending}`} size="small" sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: 11 }} />
              <Chip label={`Not Interested: ${notInterested}`} size="small" sx={{ bgcolor: '#fdecea', color: '#c62828', fontWeight: 700, fontSize: 11 }} />
            </>
          )}
        </Box>

        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary', bgcolor: '#f5f5f5' } }}>
                <TableCell>Merchant/Customer</TableCell>
                <TableCell>Mobile</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Category/Details</TableCell>
                <TableCell>Opinion/Status</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="center">View</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {forms.map((form, i) => {
                const isMK = form.formType === 'mobikwik-withdraw';
                return (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{form.merchantName || form.customerName || '-'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{form.merchantNumber || form.customerNumber || '-'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={isMK ? 'Mobikwik' : 'Daily Visit'} 
                        size="small"
                        color={isMK ? 'secondary' : 'primary'}
                        variant="outlined"
                        sx={{ fontWeight: 600, fontSize: 10, height: 20 }}
                      />
                    </TableCell>
                    <TableCell>
                      {isMK ? (
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#2e7d32', fontSize: 13 }}>
                          ₹{form.withdrawAmount} (Fee: ₹{Math.round((form.withdrawAmount || 0) * 0.03 * 100) / 100})
                        </Typography>
                      ) : (
                        <CategoryChip category={form.merchantCategory} />
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={isMK ? (form.status || form.onboardingStatus || 'Pending') : form.merchantOpinion} />
                    </TableCell>
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
                );
              })}
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
  const [viewMode, setViewMode] = useState('forms'); // 'forms' | 'merchants'

  // Merchant view state
  const [merchantData, setMerchantData] = useState([]);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [btMonth, setBtMonth] = useState('');
  const [expandedFSE, setExpandedFSE] = useState(null);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  // KPI drill-down
  const [kpiDialog, setKpiDialog] = useState(null); // 'bt-done' | 'rp-active' | 'bt-pending' | 'rp-pending'

  // Date filters
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));

  // Form type filter
  const [formTypeFilter, setFormTypeFilter] = useState('bt'); // eslint-disable-line no-unused-vars

  // Merchant form detail dialog
  const [formDetailOpen, setFormDetailOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Show cached FSEs instantly (forms too large for localStorage)
    const cachedFSEs = localStorage.getItem('admin_fses');
    if (cachedFSEs) { try { setFses(JSON.parse(cachedFSEs)); setLoading(false); } catch {} }

    try {
      const [fseRes, formsRes] = await Promise.all([
        axios.get(`${API_URL}/fse`),
        axios.get(`${API_URL}/forms?limit=5000`)
      ]);
      const fses  = fseRes.data.fses   || [];
      const forms = formsRes.data.forms || [];
      setFses(fses);
      setAllForms(forms);
      try { localStorage.setItem('admin_fses', JSON.stringify(fses)); } catch {}
      // Don't cache forms — too large
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMerchantData = useCallback(async () => {
    setMerchantLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.set('selectedMonth', selectedMonth);
      if (selectedYear) params.set('selectedYear', selectedYear);
      const res = await axios.get(`${API_URL}/fse/merchants/all?${params}`);
      setMerchantData(res.data.data || []);
      if (res.data.collectionMonth) setBtMonth(res.data.collectionMonth);
      else setBtMonth(selectedMonth || '');
    } catch (err) {
      console.error('Error fetching merchant data:', err);
    } finally {
      setMerchantLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  // Per-FSE merchant details — loaded on expand
  const [fseMerchants, setFseMerchants] = useState({}); // { fseName: merchants[] }
  const [loadingFSE, setLoadingFSE] = useState({}); // { fseName: bool }

  const fetchFSEMerchants = useCallback(async (fseName) => {
    if (fseMerchants[fseName]) return; // already loaded
    setLoadingFSE(p => ({ ...p, [fseName]: true }));
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.set('selectedMonth', selectedMonth);
      if (selectedYear) params.set('selectedYear', selectedYear);
      const res = await axios.get(`${API_URL}/fse/merchants/${encodeURIComponent(fseName)}?${params}`);
      setFseMerchants(p => ({ ...p, [fseName]: res.data.merchants || [] }));
    } catch (err) {
      console.error('Error fetching FSE merchants:', err);
    } finally {
      setLoadingFSE(p => ({ ...p, [fseName]: false }));
    }
  }, [selectedMonth, selectedYear, fseMerchants]);

  // Load all merchants for KPI drill-down — uses single fast endpoint
  const [allMerchantsLoading, setAllMerchantsLoading] = useState(false);
  const [allMerchantsData, setAllMerchantsData] = useState([]); // flat array of all merchants

  const loadAllFSEMerchants = useCallback(async () => {
    setAllMerchantsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.set('selectedMonth', selectedMonth);
      if (selectedYear) params.set('selectedYear', selectedYear);
      const res = await axios.get(`${API_URL}/fse/merchants/all-details?${params}`);
      const merchants = res.data.merchants || [];
      setAllMerchantsData(merchants);
    } catch (err) {
      console.error('Error fetching all merchants:', err);
    } finally {
      setAllMerchantsLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  const handleExpandFSE = (fseName) => {
    if (expandedFSE === fseName) {
      setExpandedFSE(null);
    } else {
      setExpandedFSE(fseName);
      fetchFSEMerchants(fseName);
    }
  };

  // Reset FSE merchants cache when month/year changes
  useEffect(() => {
    setFseMerchants({});
    setExpandedFSE(null);
    setKpiDialog(null);
    setAllMerchantsData([]); // reset all-details cache
    // Immediately re-fetch merchant summary if in merchants view
    if (viewMode === 'merchants') {
      fetchMerchantData();
    }
  }, [selectedMonth, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (viewMode === 'merchants') fetchMerchantData();
    else setExpandedFSE(null);
  }, [viewMode, fetchMerchantData]);

  // Auto-load allMerchantsData when merchantData is available
  useEffect(() => {
    if (merchantData.length > 0 && !allMerchantsLoading) {
      loadAllFSEMerchants();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantData]);

  // Auto-load all merchants when KPI dialog opens
  useEffect(() => {
    if (kpiDialog) loadAllFSEMerchants();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiDialog]);

  const fmtExcelDate = (val) => {
    if (!val || val === '–' || val === '-' || val === '0' || val === 0) return '–';
    const num = parseFloat(val);
    if (!isNaN(num) && num > 40000 && num < 55000) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000));
      return isNaN(d.getTime()) ? val : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? val : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fmtDate = (d) => {
    if (!d) return '–';
    const dt = new Date(d);
    return isNaN(dt) ? '–' : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleViewForm = (form) => {
    setSelectedForm(form);
    setFormDetailOpen(true);
  };

  // ── Merchant KPI computations ─────────────────────────────────────────
  const merchantKPIs = useMemo(() => {
    if (allMerchantsData.length > 0) {
      return {
        totalBT:      allMerchantsData.reduce((s,m) => s+(m.stage3||0), 0),
        yesterdaysBT: allMerchantsData.reduce((s,m) => s+(m.yesterdaysStage3||0), 0),
        rpActive:     allMerchantsData.filter(m => (m.rewardPassPro||'').toLowerCase()==='active').length,
        btPending:    allMerchantsData.filter(m => (m.stage3||0)===0).length,
        rpPending:    allMerchantsData.filter(m => (m.stage3||0) >= 10000 && (m.rewardPassPro||'').toLowerCase()!=='active').length,
        all: allMerchantsData
      };
    }
    return {
      totalBT:      merchantData.reduce((s,f) => s+(f.metrics.totalBT||0), 0),
      yesterdaysBT: 0,
      rpActive:     merchantData.reduce((s,f) => s+(f.metrics.rpDone||0), 0),
      btPending:    merchantData.reduce((s,f) => s+(f.metrics.total-(f.metrics.btDone||0)), 0),
      rpPending: null,
      all: []
    };
  }, [merchantData, allMerchantsData]);

  // Get drill-down merchants for selected KPI — uses allMerchantsData (single endpoint)
  const kpiDrillMerchants = useMemo(() => {
    if (!kpiDialog || allMerchantsData.length === 0) return [];
    switch (kpiDialog) {
      case 'bt-done':    return allMerchantsData.filter(m => (m.stage3||0) > 0).sort((a,b)=>(b.stage3||0)-(a.stage3||0));
      case 'rp-active':  return allMerchantsData.filter(m => (m.rewardPassPro||'').toLowerCase()==='active');
      case 'bt-pending': return allMerchantsData.filter(m => (m.stage3||0)===0);
      // RP Pending = BT ≥ ₹10,000 AND RP not active
      case 'rp-pending': return allMerchantsData
        .filter(m => (m.stage3||0) >= 10000 && (m.rewardPassPro||'').toLowerCase()!=='active')
        .sort((a,b) => (b.stage3||0)-(a.stage3||0));
      default: return [];
    }
  }, [kpiDialog, allMerchantsData]);

  // Group forms by employee name (with date and form type filter applied)
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
      
      // Form Type filter
      if (formTypeFilter === 'bt') {
        if (form.formType === 'mobikwik-withdraw') return false;
      } else if (formTypeFilter === 'mobikwik') {
        if (form.formType !== 'mobikwik-withdraw') return false;
      }
      return true;
    });

    const groups = {};
    filtered.forEach(form => {
      const emp = form.employeeName || form.fse || 'Unknown';
      if (!groups[emp]) groups[emp] = [];
      groups[emp].push(form);
    });
    return groups;
  }, [allForms, dateFilter, fromDate, toDate, selectedYear, selectedMonth, formTypeFilter]);

  // Filter FSEs based on search
  // eslint-disable-next-line no-unused-vars
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
        (f.merchantName || f.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.merchantNumber || f.customerNumber || '').includes(search)
      );
      if (fseMatch || formMatch) {
        result[empName] = fseMatch ? forms : forms.filter(f =>
          (f.merchantName || f.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
          (f.merchantNumber || f.customerNumber || '').includes(search)
        );
      }
    });
    return result;
  }, [groupedByEmployee, search]);

  // Compute overall KPIs from filtered forms
  const filteredFormsList = useMemo(() => Object.values(groupedByEmployee).flat(), [groupedByEmployee]);
  
  const isMobikwikSelected = formTypeFilter === 'mobikwik';
  
  // BT KPIs
  const totalOnboarded = filteredFormsList.filter(f => f.onboardingStatus === 'Completed').length;
  const totalPending = filteredFormsList.filter(f => f.onboardingStatus === 'Pending/Hold').length;
  const totalNotInterested = filteredFormsList.filter(f => f.merchantOpinion === 'Not interested').length;
  const totalReady = filteredFormsList.filter(f => f.merchantOpinion === 'Ready For Onboarding').length;

  // Mobikwik KPIs
  const totalWithdrawAmount = filteredFormsList.reduce((s, f) => s + (f.withdrawAmount || 0), 0);
  const totalWithdrawFees = Math.round(totalWithdrawAmount * 0.03 * 100) / 100;
  const avgWithdrawAmount = filteredFormsList.length > 0 ? Math.round(totalWithdrawAmount / filteredFormsList.length) : 0;
  const activeFSECount = Object.keys(groupedByEmployee).length;

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
          <Typography variant="body2" color="text.secondary" component="div">
            {fses.length} FSEs · {allForms.length} total records
            {viewMode === 'merchants' && btMonth && (
              <Chip label={`BT: ${btMonth} ${selectedYear}`} size="small"
                sx={{ ml: 1, bgcolor: '#e6f4ea', color: '#1a5c38', fontWeight: 700, fontSize: 11 }} />
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* View Toggle */}
          <ToggleButtonGroup value={viewMode} exclusive onChange={(e, v) => { if (v) setViewMode(v); }} size="small">
            <ToggleButton value="forms" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'none', px: 1.5 }}>
              <ListAltIcon sx={{ fontSize: 14, mr: 0.5 }} />Forms
            </ToggleButton>
            <ToggleButton value="merchants" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'none', px: 1.5 }}>
              <StorefrontIcon sx={{ fontSize: 14, mr: 0.5 }} />Merchants
            </ToggleButton>
          </ToggleButtonGroup>
          <Button startIcon={<RefreshIcon />}
            onClick={() => viewMode === 'merchants' ? fetchMerchantData() : fetchData()}
            variant="outlined"
            sx={{ color: '#1a5c38', borderColor: '#1a5c38', fontWeight: 700, '&:hover': { bgcolor: '#e6f4ea' } }}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* KPIs */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {isMobikwikSelected ? (
          <>
            <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #7e22ce30', borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="h4" fontWeight={800} color="#7e22ce">{filteredFormsList.length}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Withdrawals</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #2e7d3230', borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="h4" fontWeight={800} color="#2e7d32">₹{totalWithdrawAmount.toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Amount</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #c6282830', borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="h4" fontWeight={800} color="#c62828">₹{totalWithdrawFees.toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Fees</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #1565c030', borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="h4" fontWeight={800} color="#1565c0">₹{avgWithdrawAmount.toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Avg Withdrawal</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #ed6c0230', borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="h4" fontWeight={800} color="#ed6c02">{activeFSECount}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Active FSEs</Typography>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
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
          </>
        )}
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

      {/* Employee Groups — Forms View */}
      {viewMode === 'forms' && (
        Object.keys(filteredGroups).length === 0 ? (
          <Card sx={{ textAlign: 'center', py: 6, border: '1.5px dashed #c8e6c9' }}>
            <Typography color="text.secondary">No merchant forms found.</Typography>
          </Card>
        ) : (
          Object.entries(filteredGroups)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([empName, forms]) => {
              const fse = fses.find(f => f.name === empName) || { name: empName };
              return (
                <EmployeeGroup key={empName} fse={fse} forms={forms} onViewForm={handleViewForm} />
              );
            })
        )
      )}

      {/* Merchant View */}
      {viewMode === 'merchants' && (
        merchantLoading ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress sx={{ color: '#1a5c38' }} /></Box>
        ) : merchantData.length === 0 ? (
          <Card sx={{ textAlign: 'center', py: 6, border: '1.5px dashed #c8e6c9' }}>
            <Typography color="text.secondary">No merchant data found. Select a month to see BT data.</Typography>
          </Card>
        ) : (
          <>
          {/* ── Performance KPI Cards ─────────────────────────────── */}
          {merchantData.length > 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
              {[
                { key: 'bt-done',      label: 'Total BT Completed', value: `₹${(merchantKPIs.totalBT||0).toLocaleString()}`, color: '#e65100', bg: '#fff3e0', border: '#e6510030', icon: '💰', sub: `${merchantData.reduce((s,f)=>s+(f.metrics.btDone||0),0)} merchants` },
                { key: 'yesterday-bt', label: "Yesterday's BT",      value: `₹${(merchantKPIs.yesterdaysBT||0).toLocaleString()}`, color: '#0369a1', bg: '#e0f2fe', border: '#0369a130', icon: '📈', sub: 'BT done yesterday' },
                { key: 'rp-active',    label: 'Total RP Active',    value: merchantKPIs.rpActive,  color: '#7c3aed', bg: '#ede9fe', border: '#7c3aed30', icon: '🏅', sub: 'Reward Pass activated' },
                { key: 'rp-pending',   label: 'RP Pending',
                  value: merchantKPIs.rpPending === null
                    ? (allMerchantsLoading ? '…' : '–')
                    : merchantKPIs.rpPending,
                  color: '#92400e', bg: '#fef3c7', border: '#92400e30', icon: '🎁', sub: 'BT ≥ ₹10k, RP not activated' },
              ].map(kpi => (
                <Card key={kpi.key} onClick={() => setKpiDialog(kpi.key)}
                  sx={{ border: `1.5px solid ${kpi.border}`, borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s',
                    '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' } }}>
                  <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: 2, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{kpi.icon}</Box>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{kpi.label}</Typography>
                    </Box>
                    <Typography variant="h5" fontWeight={800} color={kpi.color}>{kpi.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{kpi.sub} · Click to drill down →</Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}

          {/* ── FSE Accordion List ──────────────────────────────────── */}
          {merchantData
            .filter(d => !search || d.fseName.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => b.metrics.total - a.metrics.total)
            .map(fseRow => {
              const isOpen = expandedFSE === fseRow.fseName;
              const m = fseRow.metrics;
              const merchants = (fseMerchants[fseRow.fseName] || []).filter(mer =>
                !search || mer.merchantName.toLowerCase().includes(search.toLowerCase()) || mer.merchantNumber.includes(search)
              );
              return (
                <Card key={fseRow.fseName} sx={{ mb: 2, border: '1.5px solid #c8e6c9', borderRadius: 2 }}>
                  {/* FSE Header */}
                  <Box onClick={() => handleExpandFSE(fseRow.fseName)}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: '#f5fff7' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ bgcolor: '#1a5c38' }}>{initials(fseRow.fseName)}</Avatar>
                      <Box>
                        <Typography fontWeight={700}>{fseRow.fseName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          TL: {fseRow.tlName} · {m.total} merchants
                          {btMonth && <span style={{ marginLeft: 6, color: '#1a5c38', fontWeight: 700 }}>· BT: {btMonth}</span>}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      {[
                        { label: `${m.total} Total`,    bg: '#e6f4ea', color: '#1a5c38' },
                        { label: `${m.btDone} BT`,      bg: '#fff3e0', color: '#e65100' },
                        { label: `${m.rpDone} RP`,      bg: '#ede9fe', color: '#7c3aed' },
                        { label: `${m.passLive} Live`,   bg: '#d8f3dc', color: '#1a4731' },
                        { label: `${m.pending} Pending`, bg: '#fef3c7', color: '#92400e' },
                        { label: `₹${(m.totalBT||0).toLocaleString()} BT Amt`, bg: '#fff3e0', color: '#e65100' },
                      ].map(c => (
                        <Chip key={c.label} label={c.label} size="small"
                          sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: 10, border: `1px solid ${c.color}20` }} />
                      ))}
                      {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </Box>
                  </Box>

                  {/* Expanded merchant table */}
                  <Collapse in={isOpen}>
                    {loadingFSE[fseRow.fseName] ? (
                      <Box display="flex" justifyContent="center" py={3} sx={{ borderTop: '1px solid #e8f3ed' }}>
                        <CircularProgress size={24} sx={{ color: '#1a5c38' }} />
                      </Box>
                    ) : merchants.length === 0 && isOpen ? (
                      <Box sx={{ p: 3, textAlign: 'center', color: '#888', borderTop: '1px solid #e8f3ed' }}>
                        <Typography variant="body2">No merchants found.</Typography>
                      </Box>
                    ) : (
                    <Box sx={{ overflowX: 'auto', borderTop: '1px solid #e8f3ed' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: 'text.secondary', bgcolor: '#f5faf7' } }}>
                            <TableCell>Merchant</TableCell>
                            <TableCell>Mobile</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">BT Amt</TableCell>
                            <TableCell align="right">BT Gap</TableCell>
                            <TableCell>RP</TableCell>
                            <TableCell>Pass Live</TableCell>
                            <TableCell align="right">UPI Txn</TableCell>
                            <TableCell>Last Activity</TableCell>
                            <TableCell align="center">View</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {merchants.map((mer, i) => (
                            <TableRow key={i} hover sx={{ '&:hover': { bgcolor: '#f5fff7' } }}>
                              <TableCell>
                                <Box>
                                  <Typography variant="body2" fontWeight={700}>{mer.merchantName}</Typography>
                                  {mer.merchantCategory && mer.merchantCategory !== '–' && (
                                    <Typography variant="caption" color="text.secondary">{mer.merchantCategory}</Typography>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{mer.merchantNumber}</TableCell>
                              <TableCell>
                                <Chip label={mer.onboardingStatus || 'Pending'} size="small"
                                  sx={{ fontSize: 10, fontWeight: 700,
                                    bgcolor: mer.onboardingStatus === 'Onboarded' ? '#d8f3dc' : mer.onboardingStatus === 'BT Active' ? '#e0f2fe' : '#fef3c7',
                                    color:  mer.onboardingStatus === 'Onboarded' ? '#1a4731' : mer.onboardingStatus === 'BT Active' ? '#0369a1' : '#92400e',
                                  }} />
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight={700} color={mer.stage3 > 0 ? '#e65100' : '#999'}>
                                  {mer.stage3 > 0 ? `₹${mer.stage3.toLocaleString()}` : '–'}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" color={mer.stage3Gap > 0 ? '#c62828' : '#999'}>
                                  {mer.stage3Gap > 0 ? `₹${mer.stage3Gap.toLocaleString()}` : '–'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {(mer.rewardPassPro||'').toLowerCase() === 'active'
                                  ? <Chip label="Active" size="small" sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: 10 }} />
                                  : <Typography variant="caption" color="text.secondary">–</Typography>}
                              </TableCell>
                              <TableCell>
                                {(mer.passLive||'').toLowerCase() === 'live'
                                  ? <Chip label="Live ✓" size="small" sx={{ bgcolor: '#d8f3dc', color: '#1a4731', fontWeight: 700, fontSize: 10 }} />
                                  : <Typography variant="caption" color="text.secondary">–</Typography>}
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" color={mer.upiTxnCount > 0 ? '#0369a1' : '#999'}>
                                  {mer.upiTxnCount > 0 ? mer.upiTxnCount : '–'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">{fmtDate(mer.lastActivity)}</Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip title="View merchant details">
                                  <IconButton size="small" onClick={() => setSelectedMerchant(mer)}
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
                    )}
                  </Collapse>
                </Card>
              );
            })}
          </>
        )
      )}

      {/* KPI Drill-down Dialog */}
      <Dialog open={!!kpiDialog} onClose={() => setKpiDialog(null)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <Box sx={{ background: 'linear-gradient(135deg, #1a5c38, #2d6a4f)', px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, letterSpacing: 1.5 }}>DRILL-DOWN</Typography>
            <Typography variant="h6" fontWeight={800} color="#fff">
              {kpiDialog === 'bt-done'    ? '💰 BT Completed Merchants' :
               kpiDialog === 'rp-active'  ? '🏅 RP Active Merchants' :
               kpiDialog === 'bt-pending' ? '⏳ BT Pending Merchants' :
               kpiDialog === 'rp-pending' ? '🎁 RP Pending Merchants' : ''}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {allMerchantsLoading ? 'Loading...' : `${kpiDrillMerchants.length} merchants`} · {btMonth || selectedMonth} {selectedYear}
            </Typography>
          </Box>
          <IconButton onClick={() => setKpiDialog(null)} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 0 }}>
          {allMerchantsLoading ? (
            <Box display="flex" flexDirection="column" alignItems="center" py={6} gap={2}>
              <CircularProgress sx={{ color: '#1a5c38' }} />
              <Typography color="text.secondary" variant="body2">Loading all FSE merchants...</Typography>
            </Box>
          ) : kpiDrillMerchants.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No merchants found for this filter.</Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary', bgcolor: '#f5faf7' } }}>
                    <TableCell>FSE</TableCell>
                    <TableCell>Merchant</TableCell>
                    <TableCell>Mobile</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">BT Amount</TableCell>
                    <TableCell>RP</TableCell>
                    <TableCell>Pass Live</TableCell>
                    {kpiDialog === 'rp-pending' && <TableCell align="right">Pending Days</TableCell>}
                    <TableCell>Last Activity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {kpiDrillMerchants.map((m, i) => (
                    <TableRow key={i} hover>
                      <TableCell>
                        <Typography variant="caption" fontWeight={700} color="#1a5c38">{m.fseName}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{m.merchantName}</Typography>
                        {m.merchantCategory && m.merchantCategory !== '–' && (
                          <Typography variant="caption" color="text.secondary">{m.merchantCategory}</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{m.merchantNumber}</TableCell>
                      <TableCell>
                        <Chip label={m.onboardingStatus || 'Pending'} size="small"
                          sx={{ fontSize: 10, fontWeight: 700,
                            bgcolor: m.onboardingStatus === 'Onboarded' ? '#d8f3dc' : m.onboardingStatus === 'BT Active' ? '#e0f2fe' : '#fef3c7',
                            color:  m.onboardingStatus === 'Onboarded' ? '#1a4731' : m.onboardingStatus === 'BT Active' ? '#0369a1' : '#92400e',
                          }} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} color={m.stage3 > 0 ? '#e65100' : '#999'}>
                          {m.stage3 > 0 ? `₹${m.stage3.toLocaleString()}` : '–'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {(m.rewardPassPro||'').toLowerCase()==='active'
                          ? <Chip label="Active" size="small" sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: 10 }} />
                          : <Typography variant="caption" color="text.secondary">–</Typography>}
                      </TableCell>
                      <TableCell>
                        {(m.passLive||'').toLowerCase()==='live'
                          ? <Chip label="Live ✓" size="small" sx={{ bgcolor: '#d8f3dc', color: '#1a4731', fontWeight: 700, fontSize: 10 }} />
                          : <Typography variant="caption" color="text.secondary">–</Typography>}
                      </TableCell>
                      {kpiDialog === 'rp-pending' && (
                        <TableCell align="right">
                          {(() => {
                            const lastDate = m.lastActivity ? new Date(m.lastActivity) : null;
                            if (!lastDate || isNaN(lastDate)) return <Typography variant="caption" color="text.secondary">–</Typography>;
                            const days = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
                            return (
                              <Chip label={`${days}d`} size="small"
                                sx={{ bgcolor: days > 7 ? '#fdecea' : '#fff3e0', color: days > 7 ? '#c62828' : '#e65100', fontWeight: 700, fontSize: 10 }} />
                            );
                          })()}
                        </TableCell>
                      )}
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{fmtDate(m.lastActivity)}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {kpiDrillMerchants.length > 0 && (
                <Box sx={{ p: 1.5, textAlign: 'center', borderTop: '1px solid #e8f3ed' }}>
                  <Typography variant="caption" color="text.secondary">Total: {kpiDrillMerchants.length} merchants</Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setKpiDialog(null)} sx={{ color: '#1a5c38', fontWeight: 700 }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Merchant Detail Dialog */}
      <Dialog open={!!selectedMerchant} onClose={() => setSelectedMerchant(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <Box sx={{ background: 'linear-gradient(135deg, #1a5c38, #2d6a4f)', px: 3, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, letterSpacing: 1.5 }}>MERCHANT DETAILS</Typography>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800 }}>{selectedMerchant?.merchantName}</Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>FSE: {selectedMerchant?.fseName} · 📞 {selectedMerchant?.merchantNumber}</Typography>
          </Box>
          <IconButton onClick={() => setSelectedMerchant(null)} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 3 }}>
          {selectedMerchant && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              {[
                ['TL', selectedMerchant.tl],
                ['Category', selectedMerchant.merchantCategory],
                ['Status', selectedMerchant.onboardingStatus],
                ['Last Activity', fmtDate(selectedMerchant.lastActivity)],
                ['Form Submitted', fmtDate(selectedMerchant.submissionDate)],
                ['Latest Opinion', selectedMerchant.latestOpinion],
                [`BT Done (${btMonth})`, selectedMerchant.stage3 > 0 ? `₹${selectedMerchant.stage3.toLocaleString()}` : null],
                [`BT Gap (${btMonth})`, selectedMerchant.stage3Gap > 0 ? `₹${selectedMerchant.stage3Gap.toLocaleString()}` : null],
                ['UPI Amount', selectedMerchant.upiAmount > 0 ? `₹${selectedMerchant.upiAmount.toLocaleString()}` : null],
                ['UPI Transactions', selectedMerchant.upiTxnCount > 0 ? `${selectedMerchant.upiTxnCount} txn` : null],
                ['UPI Status', selectedMerchant.upiActive !== '–' ? selectedMerchant.upiActive : null],
                ['Pass Live', selectedMerchant.passLive !== '–' ? selectedMerchant.passLive : null],
                ['Reward Pass Pro', selectedMerchant.rewardPassPro !== '–' ? selectedMerchant.rewardPassPro : null],
                ['RP Active Date', fmtExcelDate(selectedMerchant.rewardsPassProActiveDate)],
                ['Priority Pass', selectedMerchant.priorityPassStatus !== '–' ? selectedMerchant.priorityPassStatus : null],
                ['MSME/GST', selectedMerchant.msmegstStatus !== '–' ? selectedMerchant.msmegstStatus : null],
                ['Insurance', selectedMerchant.insuranceStatus !== '–' ? selectedMerchant.insuranceStatus : null],
                ['BT Verified', selectedMerchant.btVerified ? '✅ Yes' : '⏳ No'],
              ].filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== '–').map(([label, value]) => (
                <Box key={label}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
                  <Typography variant="body2" fontWeight={600}>{value}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSelectedMerchant(null)} sx={{ color: '#1a5c38', fontWeight: 700 }}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={formDetailOpen} onClose={() => setFormDetailOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <Box sx={{ 
          background: selectedForm?.formType === 'mobikwik-withdraw' 
            ? 'linear-gradient(135deg, #7e22ce, #a855f7)' 
            : 'linear-gradient(135deg, #1a5c38dd, #1a5c3888)', 
          px: 3, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' 
        }}>
          <Box>
            <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, letterSpacing: 1.5 }}>
              {selectedForm?.formType === 'mobikwik-withdraw' ? 'MOBIKWIK TRANSACTION' : 'MERCHANT DETAILS'}
            </Typography>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800 }}>
              {selectedForm?.merchantName || selectedForm?.customerName || '-'}
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
            selectedForm.formType === 'mobikwik-withdraw' ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Customer/Merchant Name</Typography>
                  <Typography variant="body1" fontWeight={700}>{selectedForm.merchantName || selectedForm.customerName || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Customer/Merchant Mobile</Typography>
                  <Typography variant="body1" fontWeight={700} sx={{ fontFamily: 'monospace' }}>{selectedForm.merchantNumber || selectedForm.customerNumber || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Withdraw Amount</Typography>
                  <Typography variant="body1" fontWeight={700} color="#2e7d32">₹{selectedForm.withdrawAmount || 0}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Withdraw Fees</Typography>
                  <Typography variant="body1" fontWeight={700} color="#c62828">₹{Math.round((selectedForm.withdrawAmount || 0) * 0.03 * 100) / 100}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Reason of Withdraw</Typography>
                  <Typography variant="body2">{selectedForm.reasonOfWithdraw || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Transaction Date</Typography>
                  <Typography variant="body2">{selectedForm.transactionDate || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>TL</Typography>
                  <Typography variant="body2">{selectedForm.tl || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Submitted By (FSE)</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: '#7e22ce' }}>
                      {initials(selectedForm.employeeName)}
                    </Avatar>
                    <Typography variant="body2" fontWeight={600}>{selectedForm.employeeName || '-'}</Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Date Synced</Typography>
                  <Typography variant="body2">
                    {selectedForm.createdAt ? new Date(selectedForm.createdAt).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : '-'}
                  </Typography>
                </Box>
              </Box>
            ) : (
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
            )
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormDetailOpen(false)} sx={{ color: selectedForm?.formType === 'mobikwik-withdraw' ? '#7e22ce' : '#1a5c38', fontWeight: 700 }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
