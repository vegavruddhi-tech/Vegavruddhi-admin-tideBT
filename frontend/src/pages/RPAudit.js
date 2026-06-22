import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, CircularProgress,
  Collapse, IconButton, Avatar, Button, Tabs, Tab, TextField, Pagination,
  InputAdornment
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import DateFilter from '../components/DateFilter';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function initials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function RPAudit() {
  const [auditData, setAuditData] = useState([]);
  const [tlAuditData, setTlAuditData] = useState([]);
  const [rawSubmissions, setRawSubmissions] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);
  
  // Date filter states
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));

  // Tab and filter states
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 50;

  // New FSE/TL states
  const [fses, setFses] = useState([]);
  const [tls, setTls] = useState([]);
  const [selectedTlFilter, setSelectedTlFilter] = useState('');
  const [selectedFseFilter, setSelectedFseFilter] = useState('');

  useEffect(() => { 
    fetchAudit(); 
  }, [dateFilter, fromDate, toDate, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchFsesAndTls();
  }, []);

  const fetchFsesAndTls = async () => {
    try {
      const [fseRes, tlRes] = await Promise.all([
        axios.get(`${API_URL}/fse`),
        axios.get(`${API_URL}/tl`)
      ]);
      setFses(fseRes.data.fses || []);
      setTls(tlRes.data.tls || []);
    } catch (err) {
      console.error('Error fetching FSEs/TLs in RPAudit:', err);
    }
  };

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const params = {
        dateFilter,
        fromDate,
        toDate,
        selectedYear,
        selectedMonth
      };
      const res = await axios.get(`${API_URL}/rp-audit`, { params });
      setAuditData(res.data.audit || []);
      setTlAuditData(res.data.tlAudit || []);
      setSummary(res.data.summary || {});
      setRawSubmissions(res.data.rawSubmissions || []);
    } catch (err) {
      console.error('Error fetching RP audit:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter audit summary data based on TL and FSE filters
  const filteredAuditData = useMemo(() => {
    return auditData.filter(row => {
      // TL filter
      if (selectedTlFilter) {
        const isTL = row.employeeName === selectedTlFilter;
        const isFseUnderTL = fses.some(f => f.name === row.employeeName && f.reportingManager === selectedTlFilter);
        if (!isTL && !isFseUnderTL) return false;
      }

      // FSE filter
      if (selectedFseFilter && row.employeeName !== selectedFseFilter) return false;

      return true;
    });
  }, [auditData, selectedTlFilter, selectedFseFilter, fses]);

  // Filter TL audit data
  const filteredTlAuditData = useMemo(() => {
    return tlAuditData.filter(row => {
      if (selectedTlFilter && row.employeeName !== selectedTlFilter) return false;
      return true;
    });
  }, [tlAuditData, selectedTlFilter]);

  // Recalculate summary KPIs based on filtered audit data
  const displaySummary = useMemo(() => {
    const totalEmployees = filteredAuditData.length;
    const totalMismatches = filteredAuditData.filter(r => r.mismatch).length;
    const totalClaimedRP = filteredAuditData.reduce((s, r) => s + (r.totalClaimedRP || 0), 0);
    const totalActualOnboarded = filteredAuditData.reduce((s, r) => s + (r.actualOnboarded || 0), 0);

    return {
      totalEmployees,
      totalMismatches,
      totalClaimedRP,
      totalActualOnboarded
    };
  }, [filteredAuditData]);

  // Filter raw submissions
  const filteredSubmissions = useMemo(() => {
    let result = rawSubmissions;

    // TL filter
    if (selectedTlFilter) {
      result = result.filter(sub => 
        sub.tl === selectedTlFilter || 
        fses.some(f => f.name === sub.employeeName && f.reportingManager === selectedTlFilter)
      );
    }

    // FSE filter
    if (selectedFseFilter) {
      result = result.filter(sub => sub.employeeName === selectedFseFilter);
    }

    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(sub => 
        (sub.employeeName || '').toLowerCase().includes(query) ||
        (sub.tl || '').toLowerCase().includes(query) ||
        (sub.employeeEmail || '').toLowerCase().includes(query) ||
        (sub.workingUpdate || '').toLowerCase().includes(query)
      );
    }

    return result;
  }, [rawSubmissions, searchQuery, selectedTlFilter, selectedFseFilter, fses]);

  // Paginated raw submissions
  const paginatedSubmissions = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredSubmissions.slice(start, start + rowsPerPage);
  }, [filteredSubmissions, page]);

  const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setPage(1); // Reset page on tab switch
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="#1a5c38">🏅 RP Audit & Responses</Typography>
          <Typography variant="body2" color="text.secondary">
            Reward Pass verification and submission tracking — Claimed vs Actual Onboarded
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          {loading && <CircularProgress size={20} sx={{ color: '#1a5c38' }} />}
          <Button startIcon={<RefreshIcon />} onClick={fetchAudit} variant="outlined" disabled={loading}
            sx={{ color: '#1a5c38', borderColor: '#1a5c38', fontWeight: 700 }}>
            Refresh
          </Button>
        </Box>
      </Box>

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

      {/* Summary KPIs */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #1565c030', borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="h5" fontWeight={800} color="#1565c0">{displaySummary.totalEmployees || 0}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Employees</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #c6282830', borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="h5" fontWeight={800} color="#c62828">{displaySummary.totalMismatches || 0}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Mismatches</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #7c3aed30', borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="h5" fontWeight={800} color="#7c3aed">{displaySummary.totalClaimedRP || 0}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Claimed RP</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 140, border: '1.5px solid #2e7d3230', borderRadius: 2 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="h5" fontWeight={800} color="#2e7d32">{displaySummary.totalActualOnboarded || 0}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Actual RP</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Tabs Menu */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': { 
              fontWeight: 700, 
              color: '#666666',
              '&.Mui-selected': { color: '#1a5c38' }
            },
            '& .MuiTabs-indicator': { bgcolor: '#1a5c38' }
          }}
        >
          <Tab label="Audit Summary" />
          <Tab label="TL Audit Summary" />
          <Tab label={`Reward Pass Responses (${rawSubmissions.length})`} />
        </Tabs>
      </Box>

      {/* Tab 0: Audit Table */}
      <Box sx={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s', pointerEvents: loading ? 'none' : 'auto' }}>
      {activeTab === 0 && (
        <>
          {filteredAuditData.length === 0 ? (
            <Card sx={{ textAlign: 'center', py: 6, border: '1.5px dashed #c8e6c9' }}>
              <Typography color="text.secondary">No reward pass data found. FSEs/TLs haven't submitted any RP forms yet.</Typography>
            </Card>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5', '& th': { fontWeight: 700, fontSize: 12 } }}>
                    <TableCell>Employee</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell align="center">Claimed RP</TableCell>
                    <TableCell align="center">Actual Onboarded</TableCell>
                    <TableCell align="center">Difference</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">BT Amount</TableCell>
                    <TableCell align="center">Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAuditData.map((row, i) => (
                    <React.Fragment key={i}>
                      <TableRow hover sx={{ bgcolor: row.mismatch ? '#fff5f5' : 'inherit' }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: row.mismatch ? '#c62828' : '#1a5c38' }}>
                              {initials(row.employeeName)}
                            </Avatar>
                            <Typography fontWeight={700} fontSize={13}>{row.employeeName}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={row.role} size="small" sx={{ fontWeight: 700, fontSize: 10 }} />
                        </TableCell>
                        <TableCell align="center">
                          <Typography fontWeight={700} color="#7c3aed">{row.totalClaimedRP}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography fontWeight={700} color="#2e7d32">{row.actualOnboarded}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          {row.mismatch ? (
                            <Chip label={`+${row.difference} extra`} size="small"
                              sx={{ bgcolor: '#fdecea', color: '#c62828', fontWeight: 700, fontSize: 11 }} />
                          ) : (
                            <Chip label="0" size="small" sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700 }} />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {row.mismatch ? (
                            <Chip icon={<WarningAmberIcon sx={{ fontSize: 14 }} />} label="Mismatch" size="small"
                              sx={{ bgcolor: '#fdecea', color: '#c62828', fontWeight: 700, fontSize: 10 }} />
                          ) : (
                            <Chip icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} label="Verified" size="small"
                              sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 10 }} />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Typography fontWeight={700} color="#e65100" fontSize={13}>₹{row.totalClaimedBT?.toLocaleString()}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={() => setExpandedRow(expandedRow === i ? null : i)}>
                            {expandedRow === i ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={8} sx={{ py: 0, border: expandedRow === i ? undefined : 'none' }}>
                          <Collapse in={expandedRow === i} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 2, px: 2 }}>
                              <Typography variant="body2" fontWeight={700} mb={1}>Daily Submissions:</Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, color: 'text.secondary' } }}>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Working Status</TableCell>
                                    <TableCell align="center">Claimed RP</TableCell>
                                    <TableCell align="center">BT Amount</TableCell>
                                    <TableCell>Submitted</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {row.entries.map((entry, j) => (
                                    <TableRow key={j}>
                                      <TableCell>{entry.date || '–'}</TableCell>
                                      <TableCell>
                                        <Chip label={entry.workingUpdate} size="small" sx={{ fontSize: 10, fontWeight: 600 }} />
                                      </TableCell>
                                      <TableCell align="center" sx={{ fontWeight: 700, color: '#7c3aed' }}>{entry.claimedRP}</TableCell>
                                      <TableCell align="center" sx={{ fontWeight: 700, color: '#e65100' }}>₹{entry.btAmount?.toLocaleString()}</TableCell>
                                      <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>
                                        {entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              {/* Actual verified merchants from Tide */}
                              {row.actualMerchants && row.actualMerchants.length > 0 && (
                                <Box mt={2}>
                                  <Typography variant="body2" fontWeight={700} mb={1} color="#2e7d32">
                                    ✅ Tide Verified Merchants ({row.actualMerchants.length}):
                                  </Typography>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, color: '#2e7d32' } }}>
                                        <TableCell>Lead Name</TableCell>
                                        <TableCell>Mobile</TableCell>
                                        <TableCell>Pass Pro Active</TableCell>
                                        <TableCell>TL</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {row.actualMerchants.map((m, k) => (
                                        <TableRow key={k}>
                                          <TableCell sx={{ fontWeight: 600 }}>{m.lead || '–'}</TableCell>
                                          <TableCell sx={{ fontSize: 11 }}>{m.mobile || '–'}</TableCell>
                                          <TableCell sx={{ fontSize: 11, color: '#2e7d32', fontWeight: 600 }}>
                                            {m.passProActive ? new Date(m.passProActive).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}
                                          </TableCell>
                                          <TableCell sx={{ fontSize: 11 }}>{m.tlName || '–'}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </Box>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Tab 1: TL Audit Summary */}
      {activeTab === 1 && (
        <>
          {filteredTlAuditData.length === 0 ? (
            <Card sx={{ textAlign: 'center', py: 6, border: '1.5px dashed #c8e6c9' }}>
              <Typography color="text.secondary">No TL reward pass data found. TLs haven't submitted any RP forms yet.</Typography>
            </Card>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f0f4ff', '& th': { fontWeight: 700, fontSize: 12 } }}>
                    <TableCell>TL Name</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell align="center">Claimed RP</TableCell>
                    <TableCell align="center">Actual Onboarded</TableCell>
                    <TableCell align="center">Difference</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">BT Amount</TableCell>
                    <TableCell align="center">Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTlAuditData.map((row, i) => (
                    <React.Fragment key={`tl-${i}`}>
                      <TableRow hover sx={{ bgcolor: row.mismatch ? '#fff5f5' : 'inherit' }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: row.mismatch ? '#c62828' : '#1565c0' }}>
                              {initials(row.employeeName)}
                            </Avatar>
                            <Typography fontWeight={700} fontSize={13}>{row.employeeName}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label="TL" size="small" sx={{ fontWeight: 700, fontSize: 10, bgcolor: '#e8eaf6', color: '#1565c0' }} />
                        </TableCell>
                        <TableCell align="center">
                          <Typography fontWeight={700} color="#7c3aed">{row.totalClaimedRP}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography fontWeight={700} color="#2e7d32">{row.actualOnboarded}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          {row.mismatch ? (
                            <Chip label={`+${row.difference} extra`} size="small"
                              sx={{ bgcolor: '#fdecea', color: '#c62828', fontWeight: 700, fontSize: 11 }} />
                          ) : (
                            <Chip label="0" size="small" sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700 }} />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {row.mismatch ? (
                            <Chip icon={<WarningAmberIcon sx={{ fontSize: 14 }} />} label="Mismatch" size="small"
                              sx={{ bgcolor: '#fdecea', color: '#c62828', fontWeight: 700, fontSize: 10 }} />
                          ) : (
                            <Chip icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} label="Verified" size="small"
                              sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 10 }} />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Typography fontWeight={700} color="#e65100" fontSize={13}>₹{row.totalClaimedBT?.toLocaleString()}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={() => setExpandedRow(expandedRow === `tl-${i}` ? null : `tl-${i}`)}>
                            {expandedRow === `tl-${i}` ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={8} sx={{ py: 0, border: expandedRow === `tl-${i}` ? undefined : 'none' }}>
                          <Collapse in={expandedRow === `tl-${i}`} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 2, px: 2 }}>
                              <Typography variant="body2" fontWeight={700} mb={1}>Daily RP Submissions:</Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, color: 'text.secondary' } }}>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Working Status</TableCell>
                                    <TableCell align="center">Claimed RP</TableCell>
                                    <TableCell align="center">BT Amount</TableCell>
                                    <TableCell>Submitted</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {row.entries.map((entry, j) => (
                                    <TableRow key={j}>
                                      <TableCell>{entry.date || '–'}</TableCell>
                                      <TableCell>
                                        <Chip label={entry.workingUpdate} size="small" sx={{ fontSize: 10, fontWeight: 600 }} />
                                      </TableCell>
                                      <TableCell align="center" sx={{ fontWeight: 700, color: '#7c3aed' }}>{entry.claimedRP}</TableCell>
                                      <TableCell align="center" sx={{ fontWeight: 700, color: '#e65100' }}>₹{entry.btAmount?.toLocaleString()}</TableCell>
                                      <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>
                                        {entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              {/* FSE Breakdown from Tide official data */}
                              {row.fseBreakdown && row.fseBreakdown.length > 0 && (
                                <Box mt={2}>
                                  <Typography variant="body2" fontWeight={700} mb={1} color="#2e7d32">
                                    ✅ Tide Verified — FSE Breakdown ({row.actualOnboarded} total activations):
                                  </Typography>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, color: '#2e7d32' } }}>
                                        <TableCell>FSE Name</TableCell>
                                        <TableCell align="center">Activations</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {row.fseBreakdown.map((f, k) => (
                                        <TableRow key={k}>
                                          <TableCell sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{f.name}</TableCell>
                                          <TableCell align="center" sx={{ fontWeight: 700, color: '#2e7d32' }}>{f.count}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </Box>
                              )}
                              {row.entries.length === 0 && (
                                <Typography variant="body2" color="text.secondary" mt={1}>
                                  No personal RP form submissions found for this TL.
                                </Typography>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Tab 2: Raw Reward Pass Responses */}
      {activeTab === 2 && (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={2} flexWrap="wrap">
            <TextField
              size="small"
              placeholder="Search by FSE, TL, Email..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              sx={{
                width: { xs: '100%', sm: 300 },
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': { borderColor: '#1a5c38' }
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                )
              }}
            />
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Showing {filteredSubmissions.length} response{filteredSubmissions.length !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {filteredSubmissions.length === 0 ? (
            <Card sx={{ textAlign: 'center', py: 6, border: '1.5px dashed #ccc' }}>
              <Typography color="text.secondary">No matching reward pass responses found.</Typography>
            </Card>
          ) : (
            <>
              <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#e6f4ea', '& th': { fontWeight: 700, fontSize: 11, color: '#1a5c38' } }}>
                      <TableCell>FSE Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Working Date</TableCell>
                      <TableCell>Working Status</TableCell>
                      <TableCell align="center">Claimed RP</TableCell>
                      <TableCell align="center">RP Amount</TableCell>
                      <TableCell>TL</TableCell>
                      <TableCell>Month</TableCell>
                      <TableCell>Sync Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedSubmissions.map((sub, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontWeight: 700 }}>{sub.employeeName || '-'}</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>{sub.employeeEmail || sub.emailAddress || '-'}</TableCell>
                        <TableCell>{sub.dateOfWorking ? new Date(sub.dateOfWorking).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</TableCell>
                        <TableCell>
                          <Chip label={sub.workingUpdate || 'Working'} size="small" sx={{ fontSize: 9, fontWeight: 700 }} />
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#7c3aed' }}>{sub.totalRPCount || 0}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#e65100' }}>
                          ₹{(sub.rewardPassAmount !== undefined ? sub.rewardPassAmount : (sub.totalRPCount || 0) * 2500).toLocaleString()}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{sub.tl || '-'}</TableCell>
                        <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>{sub.month || '-'}</TableCell>
                        <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>
                          {sub.createdAt ? new Date(sub.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Local Pagination */}
              {totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={3}>
                  <Pagination 
                    count={totalPages} 
                    page={page} 
                    onChange={(e, value) => setPage(value)}
                    sx={{
                      '& .MuiPaginationItem-root.Mui-selected': {
                        bgcolor: '#1a5c38',
                        color: '#fff',
                        '&:hover': { bgcolor: '#0f3320' }
                      }
                    }}
                  />
                </Box>
              )}
            </>
          )}
        </>
      )}
      </Box>
    </Box>
  );
}
