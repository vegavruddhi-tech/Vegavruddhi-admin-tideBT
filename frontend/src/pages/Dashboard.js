import React, { useState, useEffect, useMemo } from 'react';
import { 
  Grid, Card, CardContent, Typography, Box, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
  Collapse, Avatar, Button, TextField, InputAdornment
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

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VerifiedIcon from '@mui/icons-material/Verified';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const PIE_COLORS = ['#2e7d32', '#ed6c02', '#c62828', '#1565c0'];

function initials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function fmtDate(d) {
  if (!d) return '–';
  const dt = new Date(d);
  return isNaN(dt) ? '–' : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getEmpCode(fseName) {
  if (!fseName) return 'VVT-FSE-000';
  const parts = fseName.trim().split(/\s+/);
  const initials = parts.map(p => p[0]).join('').toUpperCase().slice(0, 3);
  let hash = 0;
  for (let i = 0; i < fseName.length; i++) {
    hash = fseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const id = Math.abs(hash % 1000).toString().padStart(3, '0');
  return `VVT-${initials || 'EMP'}-${id}`;
}

function KpiDrillContent({ kpiDrillData, kpiType, rewardPassData, selectedMonth, selectedYear }) {
  const [expandedTl, setExpandedTl] = useState(null);
  const [expandedFse, setExpandedFse] = useState(null);
  const [drillSearch, setDrillSearch] = useState('');

  // Reset FSE expansion if TL collapses/changes
  const handleTlClick = (tlName) => {
    if (expandedTl === tlName) {
      setExpandedTl(null);
      setExpandedFse(null);
    } else {
      setExpandedTl(tlName);
      setExpandedFse(null);
    }
  };

  const filteredMerchants = useMemo(() => {
    if (!drillSearch) return kpiDrillData;
    const q = drillSearch.toLowerCase();
    return kpiDrillData.filter(m =>
      (m.merchantName || '').toLowerCase().includes(q) ||
      (m.merchantNumber || '').includes(q) ||
      (m.fseName || '').toLowerCase().includes(q) ||
      (m.tlName || m.tl || '').toLowerCase().includes(q)
    );
  }, [kpiDrillData, drillSearch]);

  const fseClaims = useMemo(() => {
    const claims = {};
    const filteredRP = rewardPassData.filter(rp => {
      const d = new Date(rp.dateOfWorking || rp.createdAt);
      if (isNaN(d)) return false;
      if (selectedYear && d.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth && d.toLocaleString('en-US', { month: 'long' }) !== selectedMonth) return false;
      return true;
    });
    filteredRP.forEach(rp => {
      const name = rp.employeeName;
      if (name) claims[name] = (claims[name] || 0) + (rp.totalRPCount || 0);
    });
    return claims;
  }, [rewardPassData, selectedMonth, selectedYear]);

  const hierarchy = useMemo(() => {
    const tls = {};
    filteredMerchants.forEach(m => {
      const tlName = m.tlName || m.tl || 'Unassigned TL';
      const fseName = m.fseName || 'Unassigned FSE';

      if (!tls[tlName]) {
        tls[tlName] = {
          name: tlName,
          merchants: [],
          fses: {}
        };
      }

      tls[tlName].merchants.push(m);

      if (!tls[tlName].fses[fseName]) {
        tls[tlName].fses[fseName] = {
          name: fseName,
          merchants: []
        };
      }
      tls[tlName].fses[fseName].merchants.push(m);
    });

    return Object.values(tls).map(tl => {
      const fseList = Object.values(tl.fses).map(fse => {
        const fseBT = fse.merchants.reduce((sum, m) => sum + (m.stage3 || 0) + (m.upiAmount || 0), 0);
        const fseRPActive = fse.merchants.filter(m => (m.rewardPassPro || '').toLowerCase() === 'active').length;
        const fseRPPending = fse.merchants.filter(m => (m.stage3 || 0) >= 10000 && (m.rewardPassPro || '').toLowerCase() !== 'active').length;
        const fsePassLive = fse.merchants.filter(m => (m.passLive || '').toLowerCase() === 'live').length;
        const fsePendingBT = fse.merchants.filter(m => (m.stage3 || 0) === 0).length;

        return {
          name: fse.name,
          employeeCode: getEmpCode(fse.name),
          merchants: fse.merchants,
          merchantCount: fse.merchants.length,
          btAmount: fseBT,
          rpPurchasedCount: fseClaims[fse.name] || 0,
          rpActiveCount: fseRPActive,
          rpPendingCount: fseRPPending,
          passLiveCount: fsePassLive,
          pendingBtCount: fsePendingBT
        };
      });

      const tlBT = tl.merchants.reduce((sum, m) => sum + (m.stage3 || 0) + (m.upiAmount || 0), 0);
      const tlRPActive = tl.merchants.filter(m => (m.rewardPassPro || '').toLowerCase() === 'active').length;
      const tlRPPending = tl.merchants.filter(m => (m.stage3 || 0) >= 10000 && (m.rewardPassPro || '').toLowerCase() !== 'active').length;
      const tlPassLive = tl.merchants.filter(m => (m.passLive || '').toLowerCase() === 'live').length;
      const tlPendingBT = tl.merchants.filter(m => (m.stage3 || 0) === 0).length;
      const tlRPPurchased = fseList.reduce((sum, f) => sum + f.rpPurchasedCount, 0);

      return {
        name: tl.name,
        fses: fseList,
        merchants: tl.merchants,
        fseCount: fseList.length,
        merchantCount: tl.merchants.length,
        btAmount: tlBT,
        rpPurchasedCount: tlRPPurchased,
        rpActiveCount: tlRPActive,
        rpPendingCount: tlRPPending,
        passLiveCount: tlPassLive,
        pendingBtCount: tlPendingBT
      };
    }).sort((a, b) => b.btAmount - a.btAmount);
  }, [filteredMerchants, fseClaims]);

  const tlCount = hierarchy.length;
  const totalMerchantsCount = filteredMerchants.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '70vh', overflow: 'hidden' }}>
      {/* Search Input inside Dialog */}
      <Box sx={{ p: 2, borderBottom: '1px solid #e8f3ed', bgcolor: '#fcfdfd' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by Merchant Name, Mobile, FSE, or TL..."
          value={drillSearch}
          onChange={(e) => setDrillSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
              </InputAdornment>
            ),
            endAdornment: drillSearch && (
              <IconButton size="small" onClick={() => setDrillSearch('')}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )
          }}
        />
      </Box>

      {/* Dynamic Breadcrumbs */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 3, py: 1.5, bgcolor: '#f4fbf7', borderBottom: '1px solid #e2ece7', flexWrap: 'wrap' }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mr: 0.5 }}>
          Path:
        </Typography>
        <Button
          size="small"
          onClick={() => { setExpandedTl(null); setExpandedFse(null); }}
          sx={{
            textTransform: 'none',
            fontWeight: !expandedTl ? 700 : 500,
            color: !expandedTl ? '#1a5c38' : 'text.secondary',
            minWidth: 0,
            p: 0,
            fontSize: '0.8rem',
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
          }}
        >
          All TLs
        </Button>
        {expandedTl && (
          <>
            <Typography variant="caption" color="text.secondary">➔</Typography>
            <Button
              size="small"
              onClick={() => setExpandedFse(null)}
              sx={{
                textTransform: 'none',
                fontWeight: !expandedFse ? 700 : 500,
                color: !expandedFse ? '#1a5c38' : 'text.secondary',
                minWidth: 0,
                p: 0,
                fontSize: '0.8rem',
                '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
              }}
            >
              TL: {expandedTl}
            </Button>
          </>
        )}
        {expandedFse && (
          <>
            <Typography variant="caption" color="text.secondary">➔</Typography>
            <Typography variant="caption" fontWeight={700} color="#1a5c38" sx={{ fontSize: '0.8rem' }}>
              FSE: {expandedFse}
            </Typography>
          </>
        )}
      </Box>

      {/* Info Badge */}
      <Box sx={{ px: 3, py: 1, bgcolor: '#fffbeb', borderBottom: '1px solid #fef3c7' }}>
        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 500, color: '#b45309' }}>
          💡 Totals are derived from active merchant records. Click any row to expand its details.
        </Typography>
      </Box>

      {/* Scrollable Hierarchy Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 0 }}>
        {hierarchy.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No matching records found.</Typography>
          </Box>
        ) : (
          hierarchy.map(tl => {
            const isTlExpanded = expandedTl === tl.name;
            return (
              <Box key={tl.name} sx={{ borderBottom: '1px solid #e2ece7', bgcolor: '#fff' }}>
                {/* Level 1: TL Header Card */}
                <Box
                  onClick={() => handleTlClick(tl.name)}
                  sx={{
                    px: 3,
                    py: 2,
                    bgcolor: isTlExpanded ? '#e8f5e9' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s',
                    borderLeft: isTlExpanded ? '4px solid #1a5c38' : '4px solid transparent',
                    '&:hover': { bgcolor: '#f1f8f3' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: '#1a5c38', width: 36, height: 36, fontSize: 13, fontWeight: 700 }}>
                      {initials(tl.name)}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800} color="#1a5c38">
                        TL: {tl.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          FSEs: <strong>{tl.fseCount}</strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Merchants: <strong>{tl.merchantCount}</strong>
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {kpiType === 'kpi-bt-completed' && <Chip label={`BT: ₹${tl.btAmount.toLocaleString()}`} size="small" sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: 10 }} />}
                      {kpiType === 'kpi-rp-purchased' && <Chip label={`RP Purchased: ${tl.rpPurchasedCount}`} size="small" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: 10 }} />}
                      {kpiType === 'kpi-rp-active' && <Chip label={`RP Active: ${tl.rpActiveCount}`} size="small" sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: 10 }} />}
                      {kpiType === 'kpi-rp-pending' && <Chip label={`RP Pending: ${tl.rpPendingCount}`} size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 10 }} />}
                      {kpiType === 'kpi-pass-live' && <Chip label={`Pass Live: ${tl.passLiveCount}`} size="small" sx={{ bgcolor: '#d8f3dc', color: '#1a4731', fontWeight: 700, fontSize: 10 }} />}
                      {kpiType === 'kpi-pending-bt' && <Chip label={`Pending BT: ${tl.pendingBtCount}`} size="small" sx={{ bgcolor: '#ffe4e6', color: '#be123c', fontWeight: 700, fontSize: 10 }} />}
                      {['kpi-total-merchants', 'kpi-active-fse'].includes(kpiType) && (
                        <>
                          <Chip label={`BT: ₹${tl.btAmount.toLocaleString()}`} size="small" sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: 10 }} />
                          <Chip label={`RP Act: ${tl.rpActiveCount}`} size="small" sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: 10 }} />
                        </>
                      )}
                    </Box>
                    {isTlExpanded ? <ExpandLessIcon sx={{ color: '#1a5c38' }} /> : <ExpandMoreIcon sx={{ color: '#1a5c38' }} />}
                  </Box>
                </Box>

                {/* Level 2: FSE Cards inside TL */}
                <Collapse in={isTlExpanded}>
                  <Box sx={{ bgcolor: '#f9fafb', p: 2, pl: 4, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {tl.fses.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">No FSEs under this TL.</Typography>
                    ) : (
                      tl.fses.map(fse => {
                        const isFseExpanded = expandedFse === fse.name;
                        return (
                          <Box key={fse.name} sx={{ border: '1.5px solid #e2ece7', borderRadius: 2, bgcolor: '#fff', overflow: 'hidden' }}>
                            <Box
                              onClick={() => setExpandedFse(isFseExpanded ? null : fse.name)}
                              sx={{
                                px: 2,
                                py: 1.5,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                bgcolor: isFseExpanded ? '#f0fdf4' : '#fff',
                                '&:hover': { bgcolor: '#f9fafb' }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Avatar sx={{ bgcolor: '#2e7d32', width: 28, height: 28, fontSize: 11, fontWeight: 700 }}>
                                  {initials(fse.name)}
                                </Avatar>
                                <Box>
                                  <Typography variant="body2" fontWeight={700} color="#2e7d32">
                                    FSE: {fse.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Emp Code: <strong>{fse.employeeCode}</strong> · {fse.merchantCount} merchants
                                  </Typography>
                                </Box>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  {kpiType === 'kpi-bt-completed' && <Chip label={`BT: ₹${fse.btAmount.toLocaleString()}`} size="small" sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: 9, height: 20 }} />}
                                  {kpiType === 'kpi-rp-purchased' && <Chip label={`RP Purchased: ${fse.rpPurchasedCount}`} size="small" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: 9, height: 20 }} />}
                                  {kpiType === 'kpi-rp-active' && <Chip label={`RP Act: ${fse.rpActiveCount}`} size="small" sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: 9, height: 20 }} />}
                                  {kpiType === 'kpi-rp-pending' && <Chip label={`RP Pend: ${fse.rpPendingCount}`} size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 9, height: 20 }} />}
                                  {kpiType === 'kpi-pass-live' && <Chip label={`Live: ${fse.passLiveCount}`} size="small" sx={{ bgcolor: '#d8f3dc', color: '#1a4731', fontWeight: 700, fontSize: 9, height: 20 }} />}
                                  {kpiType === 'kpi-pending-bt' && <Chip label={`Pending BT: ${fse.pendingBtCount}`} size="small" sx={{ bgcolor: '#ffe4e6', color: '#be123c', fontWeight: 700, fontSize: 9, height: 20 }} />}
                                  {['kpi-total-merchants', 'kpi-active-fse'].includes(kpiType) && (
                                    <>
                                      <Chip label={`BT: ₹${fse.btAmount.toLocaleString()}`} size="small" sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: 9, height: 20 }} />
                                      <Chip label={`RP Act: ${fse.rpActiveCount}`} size="small" sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: 9, height: 20 }} />
                                    </>
                                  )}
                                </Box>
                                {isFseExpanded ? <ExpandLessIcon fontSize="small" sx={{ color: '#2e7d32' }} /> : <ExpandMoreIcon fontSize="small" sx={{ color: '#2e7d32' }} />}
                              </Box>
                            </Box>

                            {/* Level 3: Merchants under active FSE */}
                            <Collapse in={isFseExpanded}>
                              <Box sx={{ borderTop: '1px solid #e8f3ed', overflowX: 'auto' }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ bgcolor: '#f5faf7', '& th': { fontWeight: 700, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase' } }}>
                                      <TableCell>Merchant Name</TableCell>
                                      <TableCell>Mobile Number</TableCell>
                                      <TableCell align="right">BT Amount</TableCell>
                                      <TableCell>RP Status</TableCell>
                                      <TableCell>Pass Live</TableCell>
                                      <TableCell>Onboarding Status</TableCell>
                                      <TableCell align="right">UPI Txns</TableCell>
                                      <TableCell>Last Activity</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {fse.merchants.map((m, i) => {
                                      const isRpActive = (m.rewardPassPro || '').toLowerCase() === 'active';
                                      const isPassLive = (m.passLive || '').toLowerCase() === 'live';
                                      const combinedBt = (m.stage3 || 0) + (m.upiAmount || 0);
                                      return (
                                        <TableRow key={i} hover sx={{ '&:hover': { bgcolor: '#f1fdf5' } }}>
                                          <TableCell sx={{ fontWeight: 700, color: '#333', fontSize: 12 }}>
                                            {m.merchantName || '–'}
                                          </TableCell>
                                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, color: '#555' }}>
                                            {m.merchantNumber || '–'}
                                          </TableCell>
                                          <TableCell align="right" sx={{ fontWeight: 800, color: combinedBt > 0 ? '#e65100' : '#999', fontSize: 12 }}>
                                            {combinedBt > 0 ? `₹${combinedBt.toLocaleString()}` : '–'}
                                          </TableCell>
                                          <TableCell>
                                            {isRpActive ? (
                                              <Chip label="Active" size="small" sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: 9, height: 18 }} />
                                            ) : (
                                              <Chip label="Pending" size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 9, height: 18 }} />
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {isPassLive ? (
                                              <Chip label="Live ✓" size="small" sx={{ bgcolor: '#d8f3dc', color: '#1a4731', fontWeight: 700, fontSize: 9, height: 18 }} />
                                            ) : (
                                              <Chip label="–" size="small" sx={{ bgcolor: '#f5f5f5', color: '#999', fontSize: 9, height: 18 }} />
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <Chip
                                              label={m.onboardingStatus || 'Pending'}
                                              size="small"
                                              sx={{
                                                fontSize: 9,
                                                fontWeight: 700,
                                                height: 18,
                                                bgcolor: m.onboardingStatus === 'Onboarded' ? '#d8f3dc' : m.onboardingStatus === 'BT Active' ? '#e0f2fe' : '#fef3c7',
                                                color: m.onboardingStatus === 'Onboarded' ? '#1a4731' : m.onboardingStatus === 'BT Active' ? '#0369a1' : '#92400e'
                                              }}
                                            />
                                          </TableCell>
                                          <TableCell align="right" sx={{ fontSize: 11, fontWeight: 600, color: m.upiTxnCount > 0 ? '#0369a1' : '#999' }}>
                                            {m.upiTxnCount > 0 ? m.upiTxnCount : '–'}
                                          </TableCell>
                                          <TableCell sx={{ fontSize: 10, color: 'text.secondary' }}>
                                            {fmtDate(m.lastActivity)}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </Box>
                            </Collapse>
                          </Box>
                        );
                      })
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })
        )}
      </Box>

      {/* Summary Footer */}
      <Box sx={{ p: 2, textAlign: 'center', borderTop: '1px solid #e8f3ed', bgcolor: '#fbfcfb' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Showing {totalMerchantsCount} merchants across {tlCount} active Team Leaders
        </Typography>
      </Box>
    </Box>
  );
}

export default function Dashboard() {
  const [allForms, setAllForms] = useState([]);
  const [fses, setFses] = useState([]);
  const [tls, setTls] = useState([]);
  const [payments, setPayments] = useState([]);
  const [rewardPassData, setRewardPassData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merchantsData, setMerchantsData] = useState([]);
  const [merchantsLoading, setMerchantsLoading] = useState(false);

  // Date filters
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogData, setDialogData] = useState([]);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogType, setDialogType] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const fetchMerchants = async () => {
      setMerchantsLoading(true);
      const lsKey = `admin_all_details_${selectedMonth || 'all'}_${selectedYear || 'all'}`;
      // Show cached instantly
      const stored = localStorage.getItem(lsKey);
      if (stored) {
        try {
          setMerchantsData(JSON.parse(stored));
          setMerchantsLoading(false);
          // Refresh in background
          const params = new URLSearchParams();
          if (selectedMonth) params.set('selectedMonth', selectedMonth);
          if (selectedYear) params.set('selectedYear', selectedYear);
          axios.get(`${API_URL}/fse/merchants/all-details?${params}`)
            .then(res => {
              const m = res.data.merchants || [];
              setMerchantsData(m);
              localStorage.setItem(lsKey, JSON.stringify(m));
            }).catch(() => {});
          return;
        } catch {}
      }
      try {
        const params = new URLSearchParams();
        if (selectedMonth) params.set('selectedMonth', selectedMonth);
        if (selectedYear) params.set('selectedYear', selectedYear);
        const res = await axios.get(`${API_URL}/fse/merchants/all-details?${params}`);
        const m = res.data.merchants || [];
        setMerchantsData(m);
        localStorage.setItem(lsKey, JSON.stringify(m));
      } catch (err) {
        console.error('Error fetching merchants for dashboard:', err);
      } finally {
        setMerchantsLoading(false);
      }
    };
    fetchMerchants();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    try {
      const [fseRes, tlRes, formsRes, paymentsRes, rpRes] = await Promise.all([
        axios.get(`${API_URL}/fse`),
        axios.get(`${API_URL}/tl`),
        axios.get(`${API_URL}/forms?limit=5000`),
        axios.get(`${API_URL}/fund-transfer`).catch(() => ({ data: { transfers: [] } })),
        axios.get(`${API_URL}/rp-audit`).catch(() => ({ data: { rawSubmissions: [] } }))
      ]);
      setFses(fseRes.data.fses || []);
      setTls(tlRes.data.tls || []);
      setAllForms(formsRes.data.forms || []);
      setPayments(paymentsRes.data.transfers || []);
      setRewardPassData(rpRes.data.rawSubmissions || []);
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

    return allForms.filter(f => {
      const d = new Date(f.createdAt);
      if (!f.createdAt || isNaN(d)) return true; // include if no date
      if (dateFilter === 'today' && d < today) return false;
      if (dateFilter === 'month') {
        const yr = selectedYear ? parseInt(selectedYear) : now.getFullYear();
        const ms = new Date(yr, now.getMonth(), 1);
        const me = new Date(yr, now.getMonth() + 1, 0, 23, 59, 59, 999);
        if (d < ms || d > me) return false;
      }
      if (dateFilter === 'custom') {
        if (fromDate && d < new Date(fromDate)) return false;
        if (toDate && d > new Date(toDate + 'T23:59:59')) return false;
      }
      if (selectedYear && d.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth && d.toLocaleString('en-US', { month: 'long' }) !== selectedMonth) return false;
      return true;
    });
  }, [allForms, dateFilter, fromDate, toDate, selectedYear, selectedMonth]);

  // Payments and reward pass are processed directly in tlFundChart memo to avoid date clipping.

  // Business Performance KPIs
  const performanceKpis = useMemo(() => {
    // 1. Total BT Completed — Stage-3 only (upiAmount is QR load, not BT)
    const totalBtCompleted = merchantsData.reduce((sum, m) => sum + (m.stage3 || 0), 0);

    // 2. Total RP Purchased
    const filteredRP = rewardPassData.filter(rp => {
      const d = new Date(rp.dateOfWorking || rp.createdAt);
      if (isNaN(d)) return false;
      if (selectedYear && d.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth && d.toLocaleString('en-US', { month: 'long' }) !== selectedMonth) return false;
      return true;
    });
    const totalRpPurchased = filteredRP.reduce((sum, rp) => sum + (rp.totalRPCount || 0), 0);

    // 3. Total RP Active
    const totalRpActive = merchantsData.filter(m => (m.rewardPassPro || '').toLowerCase() === 'active').length;

    // 4. RP Pending (BT >= 10k but RP not active)
    const rpPending = merchantsData.filter(m => (m.stage3 || 0) >= 10000 && (m.rewardPassPro || '').toLowerCase() !== 'active').length;

    // 5. Pass Live Count
    const passLiveCount = merchantsData.filter(m => (m.passLive || '').toLowerCase() === 'live').length;

    // 6. Pending BT Count (stage3 === 0)
    const pendingBtCount = merchantsData.filter(m => (m.stage3 || 0) === 0).length;

    // 7. Total Merchants
    const totalMerchants = merchantsData.length;

    // 8. Total Active FSEs (unique FSEs active in merchantsData)
    const uniqueFses = new Set(merchantsData.map(m => m.fseName?.trim()).filter(Boolean));
    const totalActiveFses = uniqueFses.size;

    return {
      totalBtCompleted,
      totalRpPurchased,
      totalRpActive,
      rpPending,
      passLiveCount,
      pendingBtCount,
      totalMerchants,
      totalActiveFses
    };
  }, [merchantsData, rewardPassData, selectedMonth, selectedYear]);

  // Chart 1: Top FSEs by Reward Pass Activation (replaces Forms per FSE)
  const rpPerFSE = useMemo(() => {
    const counts = {};
    merchantsData.forEach(m => {
      if ((m.rewardPassPro || '').toLowerCase() === 'active') {
        const fse = m.fseName || 'Unknown';
        counts[fse] = (counts[fse] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name: name.split(' ')[0], fullName: name, count }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [merchantsData]);

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

  // Chart 4: Top TL Teams by BT Amount
  const topTlsByBt = useMemo(() => {
    const tlBTs = {};
    merchantsData.forEach(m => {
      const tl = m.tlName || m.tl || 'Unknown';
      tlBTs[tl] = (tlBTs[tl] || 0) + (m.stage3 || 0);
    });
    return Object.entries(tlBTs)
      .map(([name, btAmount]) => ({ name, btAmount }))
      .filter(item => item.btAmount > 0)
      .sort((a, b) => b.btAmount - a.btAmount);
  }, [merchantsData]);

  // Chart 6: Top FSEs by BT Amount
  const topFsesByBt = useMemo(() => {
    const fseBTs = {};
    merchantsData.forEach(m => {
      const fse = m.fseName || 'Unknown';
      fseBTs[fse] = (fseBTs[fse] || 0) + (m.stage3 || 0);
    });
    return Object.entries(fseBTs)
      .map(([name, btAmount]) => ({ name: name.split(' ')[0], fullName: name, btAmount }))
      .filter(item => item.btAmount > 0)
      .sort((a, b) => b.btAmount - a.btAmount)
      .slice(0, 10);
  }, [merchantsData]);

  // Handle chart bar/pie click
  const handleChartClick = (type, data) => {
    setDialogOpen(true);
    setDialogLoading(false);
    
    if (type === 'fseBar') {
      const fseName = data.fullName || data.name;
      setDialogTitle(`RP Active Merchants — ${fseName}`);
      setDialogType('bt-merchants');
      setDialogData(merchantsData.filter(m => (m.fseName || '') === fseName && (m.rewardPassPro || '').toLowerCase() === 'active'));
    } else if (type === 'tlBtBar') {
      const tlName = data.name;
      setDialogTitle(`BT Completed Merchants under TL: ${tlName}`);
      setDialogType('bt-merchants');
      setDialogData(merchantsData.filter(m => (m.tlName || m.tl || '').toLowerCase().trim() === tlName.toLowerCase().trim() && (m.stage3 || 0) > 0));
    } else if (type === 'onboardingPie') {
      const segment = data.name;
      setDialogTitle(`${segment} Merchants`);
      setDialogType('forms');
      if (segment === 'Onboarded') setDialogData(filteredForms.filter(f => f.onboardingStatus === 'Completed'));
      else if (segment === 'On Hold') setDialogData(filteredForms.filter(f => f.onboardingStatus === 'Pending/Hold'));
      else if (segment === 'Not Interested') setDialogData(filteredForms.filter(f => f.merchantOpinion === 'Not interested'));
      else if (segment === 'Ready') setDialogData(filteredForms.filter(f => f.merchantOpinion === 'Ready For Onboarding' && f.onboardingStatus !== 'Completed'));
      else setDialogData([]);
    } else if (type === 'fseBtBar') {
      const fseName = data.fullName || data.name;
      setDialogTitle(`BT Completed Merchants by FSE: ${fseName}`);
      setDialogType('bt-merchants');
      setDialogData(merchantsData.filter(m => (m.fseName || '').toLowerCase().trim() === fseName.toLowerCase().trim() && (m.stage3 || 0) > 0));
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

  // Chart: Fund transferred per TL (stacked: current month fund + last month remaining)
  const tlFundChart = useMemo(() => {
    const now = new Date();
    const targetYear = selectedYear ? parseInt(selectedYear) : now.getFullYear();
    
    let targetMonthIndex;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    if (selectedMonth) {
      targetMonthIndex = monthNames.indexOf(selectedMonth);
      if (targetMonthIndex === -1) targetMonthIndex = now.getMonth();
    } else {
      targetMonthIndex = now.getMonth();
    }

    const lastMonthIndex = targetMonthIndex === 0 ? 11 : targetMonthIndex - 1;
    const lastMonthYear = targetMonthIndex === 0 ? targetYear - 1 : targetYear;

    // Map FSE to TL (case-insensitive, fallback to partial matches)
    const fseToTL = {};
    fses.forEach(fse => {
      if (fse.reportingManager) {
        fseToTL[fse.name.toLowerCase().trim()] = fse.reportingManager;
      }
    });
    
    const tlNames = new Set(tls.map(t => (t.name || '').toLowerCase().trim()));

    const getTLName = (empName) => {
      if (!empName) return 'Unknown';
      const cleanName = empName.toLowerCase().trim();
      
      // If the employee is already a TL
      if (tlNames.has(cleanName)) {
        const match = tls.find(t => (t.name || '').toLowerCase().trim() === cleanName);
        return match ? match.name : empName;
      }
      
      // Map FSE to TL
      const mappedTL = fseToTL[cleanName];
      if (mappedTL) return mappedTL;
      
      // Partial FSE match
      const partialMatchKey = Object.keys(fseToTL).find(k => k.includes(cleanName) || cleanName.includes(k));
      if (partialMatchKey) return fseToTL[partialMatchKey];

      // Partial TL match
      const partialTLKey = [...tlNames].find(k => k.includes(cleanName) || cleanName.includes(k));
      if (partialTLKey) {
        const match = tls.find(t => (t.name || '').toLowerCase().trim() === partialTLKey);
        return match ? match.name : empName;
      }
      
      return empName;
    };

    const tlData = {};
    // Initialize existing TLs
    tls.forEach(t => {
      if (t.name) {
        tlData[t.name] = { name: t.name, currentFund: 0, lastMonthRemaining: 0, totalUsed: 0 };
      }
    });

    // Only show payments sent to TLs & Managers (use raw payments unfiltered by selected date)
    const tlPayments = payments.filter(p => {
      if (p.transferToWhom) {
        return p.transferToWhom === "TL's & Managers";
      }
      // Fallback: check if the receiver's name matches a TL name directly (case-insensitive)
      const receiver = (p.transferTo || '').toLowerCase().trim();
      if (tlNames.has(receiver)) return true;
      const partialTLKey = [...tlNames].find(k => k.includes(receiver) || receiver.includes(k));
      return !!partialTLKey;
    });
    
    tlPayments.forEach(p => {
      const receiver = p.transferTo || 'Unknown';
      if (!tlData[receiver]) {
        tlData[receiver] = { name: receiver, currentFund: 0, lastMonthRemaining: 0, totalUsed: 0 };
      }
      
      const d = new Date(p.createdAt);
      if (isNaN(d)) return;
      if (d.getMonth() === targetMonthIndex && d.getFullYear() === targetYear) {
        tlData[receiver].currentFund += (p.amount || 0);
      } else if (d.getMonth() === lastMonthIndex && d.getFullYear() === lastMonthYear) {
        tlData[receiver].lastMonthRemaining += (p.amount || 0);
      }
    });

    // Subtract used amounts from last month (from reward pass raw submissions data)
    rewardPassData.forEach(rp => {
      const d = new Date(rp.dateOfWorking || rp.createdAt);
      if (isNaN(d)) return;
      
      if (d.getMonth() === lastMonthIndex && d.getFullYear() === lastMonthYear) {
        const empName = rp.employeeName;
        const tlName = getTLName(empName);
        if (!tlData[tlName]) {
          tlData[tlName] = { name: tlName, currentFund: 0, lastMonthRemaining: 0, totalUsed: 0 };
        }
        tlData[tlName].totalUsed += (rp.totalBTAmount || 0);
      }
    });

    // Calculate last month remaining = last month fund - used
    Object.values(tlData).forEach(tl => {
      tl.lastMonthRemaining = Math.max(0, tl.lastMonthRemaining - tl.totalUsed);
    });

    return Object.values(tlData)
      .filter(t => t.currentFund > 0 || t.lastMonthRemaining > 0)
      .sort((a, b) => (b.currentFund + b.lastMonthRemaining) - (a.currentFund + a.lastMonthRemaining));
  }, [payments, rewardPassData, fses, tls, selectedMonth, selectedYear]);

  const handleCardClick = async (type) => {
    setDialogOpen(true);
    setDialogLoading(false);
    setDialogType(type);

    if (type === 'kpi-bt-completed') {
      setDialogTitle('Total BT Completed (Stage 3)');
      setDialogData(merchantsData.filter(m => (m.stage3 || 0) > 0));
    } else if (type === 'kpi-rp-purchased') {
      setDialogTitle('Total RP Purchased');
      // Build FSE claims map
      const fseClaims = {};
      const filteredRP = rewardPassData.filter(rp => {
        const d = new Date(rp.dateOfWorking || rp.createdAt);
        if (isNaN(d)) return false;
        if (selectedYear && d.getFullYear() !== parseInt(selectedYear)) return false;
        if (selectedMonth && d.toLocaleString('en-US', { month: 'long' }) !== selectedMonth) return false;
        return true;
      });
      filteredRP.forEach(rp => {
        const name = rp.employeeName;
        if (name) fseClaims[name] = (fseClaims[name] || 0) + (rp.totalRPCount || 0);
      });
      setDialogData(merchantsData.filter(m => fseClaims[m.fseName] > 0));
    } else if (type === 'kpi-rp-active') {
      setDialogTitle('Total RP Active');
      setDialogData(merchantsData.filter(m => (m.rewardPassPro || '').toLowerCase() === 'active'));
    } else if (type === 'kpi-rp-pending') {
      setDialogTitle('RP Pending (BT ≥ ₹10,000 but RP not active)');
      setDialogData(merchantsData.filter(m => (m.stage3 || 0) >= 10000 && (m.rewardPassPro || '').toLowerCase() !== 'active'));
    } else if (type === 'kpi-pass-live') {
      setDialogTitle('Pass Live Count');
      setDialogData(merchantsData.filter(m => (m.passLive || '').toLowerCase() === 'live'));
    } else if (type === 'kpi-pending-bt') {
      setDialogTitle('Pending BT Count');
      setDialogData(merchantsData.filter(m => (m.stage3 || 0) === 0));
    } else if (type === 'kpi-total-merchants') {
      setDialogTitle('Total Merchants');
      setDialogData(merchantsData);
    } else if (type === 'kpi-active-fse') {
      setDialogTitle('Total Active FSEs');
      setDialogData(merchantsData);
    } else if (type === 'fse') {
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

    if (['kpi-bt-completed', 'kpi-rp-purchased', 'kpi-rp-active', 'kpi-rp-pending', 'kpi-pass-live', 'kpi-pending-bt', 'kpi-total-merchants', 'kpi-active-fse'].includes(dialogType)) {
      return (
        <KpiDrillContent 
          kpiDrillData={dialogData} 
          kpiType={dialogType} 
          rewardPassData={rewardPassData} 
          selectedMonth={selectedMonth} 
          selectedYear={selectedYear} 
        />
      );
    }

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
    if (dialogType === 'bt-merchants') {
      return (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Merchant Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Mobile</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>FSE Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>TL Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">BT Amount</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Onboarding Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>RP Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Pass Live</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {dialogData.map((m, i) => {
                const rpActive = (m.rewardPassPro || '').toLowerCase() === 'active';
                const passLive = (m.passLive || '').toLowerCase() === 'live';
                return (
                  <TableRow key={i} hover>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{m.merchantName || '-'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{m.merchantNumber || '-'}</TableCell>
                    <TableCell>{m.fseName || '-'}</TableCell>
                    <TableCell>{m.tlName || m.tl || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#e65100' }}>
                      ₹{(m.stage3 || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip label={m.onboardingStatus || 'Pending'} size="small"
                        sx={{ bgcolor: m.onboardingStatus === 'Onboarded' ? '#e6f4ea' : m.onboardingStatus === 'BT Active' ? '#e0f2fe' : '#fef3c7',
                          color: m.onboardingStatus === 'Onboarded' ? '#2e7d32' : m.onboardingStatus === 'BT Active' ? '#0369a1' : '#92400e',
                          fontWeight: 600, fontSize: 11 }} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={rpActive ? 'RP Active ✓' : 'RP Pending'}
                        size="small"
                        sx={{ bgcolor: rpActive ? '#ede9fe' : '#fef3c7', color: rpActive ? '#7c3aed' : '#92400e', fontWeight: 700, fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell>
                      {passLive
                        ? <Chip label="Live ✓" size="small" sx={{ bgcolor: '#d8f3dc', color: '#1a4731', fontWeight: 700, fontSize: 11 }} />
                        : <Chip label="–" size="small" sx={{ bgcolor: '#f5f5f5', color: '#999', fontSize: 11 }} />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      );
    }
    return null;
  };

  const statCards = [
    { title: 'Total BT Completed', value: `₹${performanceKpis.totalBtCompleted.toLocaleString()}`, icon: <AccountBalanceIcon />, color: 'linear-gradient(135deg, #e65100, #ff9800)', type: 'kpi-bt-completed' },
    { title: 'Total RP Active', value: performanceKpis.totalRpActive, icon: <VerifiedIcon />, color: 'linear-gradient(135deg, #7c3aed, #a78bfa)', type: 'kpi-rp-active' },
    { title: 'RP Pending (BT ≥ ₹10k)', value: performanceKpis.rpPending, icon: <HourglassEmptyIcon />, color: 'linear-gradient(135deg, #b45309, #f59e0b)', type: 'kpi-rp-pending' },
    { title: 'Pass Live Count', value: performanceKpis.passLiveCount, icon: <CheckCircleIcon />, color: 'linear-gradient(135deg, #15803d, #22c55e)', type: 'kpi-pass-live' },
    { title: 'Pending BT Count', value: performanceKpis.pendingBtCount, icon: <HourglassTopIcon />, color: 'linear-gradient(135deg, #be123c, #fb7185)', type: 'kpi-pending-bt' },
    { title: 'Total Merchants', value: performanceKpis.totalMerchants, icon: <PeopleIcon />, color: 'linear-gradient(135deg, #0f766e, #14b8a6)', type: 'kpi-total-merchants' },
    { title: 'Total Active FSEs', value: performanceKpis.totalActiveFses, icon: <SupervisorAccountIcon />, color: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', type: 'kpi-active-fse' },
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
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                background: card.color, color: 'white', cursor: 'pointer',
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
        {/* Chart 1: Top FSEs by RP Active */}
        <Grid item xs={12} md={8}>
          <Card sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={0.5}>Top FSEs by Reward Pass Activation</Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              {selectedMonth || 'All'} {selectedYear} · Click a bar to see merchants
            </Typography>
            {merchantsLoading ? (
              <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} /></Box>
            ) : rpPerFSE.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No RP Active data for selected period</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rpPerFSE} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip formatter={(value, name, props) => [value + ' RP Active', props.payload.fullName]} />
                  <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} cursor="pointer"
                    onClick={(data) => handleChartClick('fseBar', data)}>
                    <LabelList dataKey="count" position="top" fontSize={11} fontWeight={700} fill="#7c3aed" />
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
        {/* Chart 4: Top TL Teams by BT Amount */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Top TL Teams by BT Amount</Typography>
            {merchantsLoading ? (
              <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} sx={{ color: '#2e7d32' }} /></Box>
            ) : topTlsByBt.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No BT completed data</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topTlsByBt} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `₹${v.toLocaleString()}`} />
                  <YAxis type="category" dataKey="name" fontSize={12} width={80} />
                  <RechartsTooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'BT Amount']} />
                  <Bar dataKey="btAmount" fill="#2e7d32" radius={[0, 4, 4, 0]} cursor="pointer"
                    onClick={(data) => handleChartClick('tlBtBar', data)}>
                    <LabelList dataKey="btAmount" position="right" fontSize={11} formatter={(v) => `₹${v.toLocaleString()}`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Grid>

        {/* Chart 6: Top FSEs by BT Amount */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Top FSEs by BT Amount</Typography>
            {merchantsLoading ? (
              <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} sx={{ color: '#00897b' }} /></Box>
            ) : topFsesByBt.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No BT completed data</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topFsesByBt} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `₹${v.toLocaleString()}`} />
                  <YAxis type="category" dataKey="name" fontSize={12} width={80} />
                  <RechartsTooltip formatter={(value, name, props) => [`₹${value.toLocaleString()}`, props.payload.fullName]} />
                  <Bar dataKey="btAmount" fill="#00897b" radius={[0, 4, 4, 0]} cursor="pointer"
                    onClick={(data) => handleChartClick('fseBtBar', data)}>
                    <LabelList dataKey="btAmount" position="right" fontSize={11} formatter={(v) => `₹${v.toLocaleString()}`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row 4: Fund Transfer per TL */}
      <Grid container spacing={3} mt={1} mb={3}>
        <Grid item xs={12}>
          <Card sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Fund Transferred per TL (Current Month + Last Month Remaining)</Typography>
            {tlFundChart.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No fund transfer data</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tlFundChart} margin={{ top: 10, right: 30, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <RechartsTooltip formatter={(value) => [`₹${value.toLocaleString()}`, '']} />
                  <Legend />
                  <Bar dataKey="currentFund" name="This Month Fund" stackId="a" fill="#2e7d32" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="lastMonthRemaining" name="Last Month Remaining" stackId="a" fill="#ff9800" radius={[4, 4, 0, 0]} />
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
