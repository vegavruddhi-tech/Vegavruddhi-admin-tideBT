/**
 * Attendance page for TideBT Admin Panel
 * Two views: Daily (existing) + Monthly Overview (new)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, TextField, Card, CardContent,
  Grid, CircularProgress, Alert, InputAdornment, TableSortLabel,
  Tooltip, MenuItem, Select, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, IconButton, Button,
  ToggleButton, ToggleButtonGroup, LinearProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/People';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import RepeatIcon from '@mui/icons-material/Repeat';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TodayIcon from '@mui/icons-material/Today';

// TideBT Admin backend — filters attendance to only TideBT FSEs/TLs from TideBT_Access
const EMP_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export default function Attendance() {
  const [viewMode, setViewMode]         = useState('monthly'); // default to monthly
  const [allRecords, setAllRecords]     = useState([]);
  const [summary, setSummary]           = useState({ totalPresent: 0, totalAbsent: 0, totalRelogins: 0 });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole]     = useState('all');
  const [sortField, setSortField]       = useState('status');
  const [sortDir, setSortDir]           = useState('asc');
  const [now, setNow]                   = useState(new Date());
  const [teamModal, setTeamModal]       = useState(null);
  const [teamFilter, setTeamFilter]     = useState('all');

  // Monthly view state
  const [monthlyData, setMonthlyData]   = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlySearch, setMonthlySearch]   = useState('');
  const [monthlyRole, setMonthlyRole]       = useState('all');
  const [selectedYear, setSelectedYear]     = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth]   = useState(new Date().getMonth() + 1);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const fetchMonthly = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const res = await fetch(`${EMP_BASE}/attendance/admin/monthly?year=${selectedYear}&month=${selectedMonth}`);
      const data = await res.json();
      setMonthlyData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setMonthlyLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  // Fetch monthly whenever month/year changes OR on first load
  useEffect(() => {
    fetchMonthly();
  }, [fetchMonthly]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchFull();
    fetchSummary();
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFull = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${EMP_BASE}/attendance/admin/all?date=${selectedDate}`);
      if (!res.ok && res.status !== 304) throw new Error('Failed to fetch attendance');
      const data = await res.json();
      setAllRecords(data.attendance || data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load attendance data. Check TideBT admin backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${EMP_BASE}/attendance/admin/summary?date=${selectedDate}`);
      if (!res.ok && res.status !== 304) throw new Error();
      const data = await res.json();
      setSummary(data);
    } catch {
      // silent
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filtered = allRecords
    .filter(r => filterStatus === 'all' || r.status === filterStatus)
    .filter(r => filterRole === 'all' || r.userType === filterRole)
    .filter(r => {
      const q = search.toLowerCase();
      return (
        (r.userName || '').toLowerCase().includes(q) ||
        (r.userEmail || '').toLowerCase().includes(q) ||
        (r.userType || '').toLowerCase().includes(q) ||
        (r.position || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q)
      );
    });

  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortField] ?? '';
    let bVal = b[sortField] ?? '';
    if (sortField === 'firstLoginTime' || sortField === 'lastActivityTime') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const fseCount     = allRecords.filter(r => r.userType === 'employee').length;
  const tlCount      = allRecords.filter(r => r.userType === 'teamlead').length;
  const managerCount = allRecords.filter(r => r.userType === 'manager').length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Attendance</Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            {[{ key: 'monthly', label: '📅 Monthly Overview' }, { key: 'daily', label: '📋 Daily' }].map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                style={{ padding: '5px 14px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: 12,
                  background: viewMode === v.key ? '#1a5c38' : '#e6f4ea',
                  color: viewMode === v.key ? '#fff' : '#1a5c38' }}>
                {v.label}
              </button>
            ))}
          </Box>
        </Box>
        <Button
          variant="outlined"
          startIcon={(loading || monthlyLoading) ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={() => viewMode === 'daily' ? (fetchFull(), fetchSummary()) : fetchMonthly()}
          disabled={loading || monthlyLoading}
          sx={{ borderColor: '#2e7d32', color: '#2e7d32', fontWeight: 700, '&:hover': { bgcolor: '#e8f5e9', borderColor: '#2e7d32' } }}
        >
          Refresh
        </Button>
      </Box>

      {/* ── MONTHLY VIEW ─────────────────────────────────────── */}
      {viewMode === 'monthly' && (
        <Box>
          {/* Month/Year selector */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Month</InputLabel>
              <Select value={selectedMonth} label="Month" onChange={e => setSelectedMonth(e.target.value)}>
                {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Year</InputLabel>
              <Select value={selectedYear} label="Year" onChange={e => setSelectedYear(e.target.value)}>
                {[2025, 2026, 2027].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Role</InputLabel>
              <Select value={monthlyRole} label="Role" onChange={e => setMonthlyRole(e.target.value)}>
                <MenuItem value="all">All Roles</MenuItem>
                <MenuItem value="teamlead">TL Only</MenuItem>
                <MenuItem value="employee">FSE Only</MenuItem>
              </Select>
            </FormControl>
            <TextField
              placeholder="Search name…" value={monthlySearch}
              onChange={e => setMonthlySearch(e.target.value)} size="small" sx={{ minWidth: 200 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
          </Box>

          {monthlyLoading ? (
            <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
          ) : !monthlyData ? (
            <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
          ) : (() => {
            const rows = (monthlyData.summary || [])
              .filter(r => monthlyRole === 'all' || r.userType === monthlyRole)
              .filter(r => !monthlySearch || (r.name || '').toLowerCase().includes(monthlySearch.toLowerCase()));

            const totalDays  = monthlyData.totalWorkingDays || 0;
            const avgPresent = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.daysPresent, 0) / rows.length) : 0;
            const fullPresent = rows.filter(r => r.daysPresent === totalDays).length;
            const neverPresent = rows.filter(r => r.daysPresent === 0).length;

            return (
              <Box>
                {/* Monthly summary chips */}
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                  {[
                    { label: `${MONTHS[selectedMonth-1]} ${selectedYear}`, value: `${totalDays} working days`, color: '#1a5c38', bg: '#e6f4ea' },
                    { label: 'Total People', value: rows.length, color: '#0369a1', bg: '#e0f2fe' },
                    { label: 'Full Attendance', value: fullPresent, color: '#15803d', bg: '#d8f3dc' },
                    { label: 'Never Present', value: neverPresent, color: '#be123c', bg: '#ffe4e6' },
                    { label: 'Avg Present Days', value: avgPresent, color: '#b45309', bg: '#fef3c7' },
                  ].map(s => (
                    <Card key={s.label} sx={{ bgcolor: s.bg, border: `1.5px solid ${s.color}20`, minWidth: 130 }}>
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Typography sx={{ fontSize: 9, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</Typography>
                        <Typography sx={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>

                {/* Monthly table */}
                <TableContainer component={Paper} sx={{ boxShadow: 3, borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>TL</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">Days Present</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">Days Absent</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">Attendance %</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>Attendance Bar</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center">
                            <Typography color="text.secondary" sx={{ py: 3 }}>No records found.</Typography>
                          </TableCell>
                        </TableRow>
                      ) : rows.map((r, i) => {
                        const pct = r.attendancePercent;
                        const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
                        return (
                          <TableRow key={r.name} hover sx={{ bgcolor: r.daysPresent === 0 ? 'rgba(239,68,68,0.04)' : 'inherit' }}>
                            <TableCell sx={{ color: '#888', fontSize: 11 }}>{i + 1}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={700}>{r.name}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={r.userType === 'teamlead' ? 'TL' : 'FSE'} size="small"
                                color={r.userType === 'teamlead' ? 'warning' : 'primary'} variant="outlined"
                                sx={{ fontSize: 10, height: 20 }} />
                            </TableCell>
                            <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>{r.tlName || '—'}</TableCell>
                            <TableCell align="center">
                              <Typography fontWeight={800} color={r.daysPresent > 0 ? '#15803d' : '#be123c'} fontSize={14}>
                                {r.daysPresent}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography fontWeight={700} color={r.daysAbsent > 0 ? '#be123c' : '#15803d'} fontSize={13}>
                                {r.daysAbsent}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${pct}%`} size="small"
                                sx={{ fontWeight: 800, fontSize: 11,
                                  bgcolor: pct >= 80 ? '#d8f3dc' : pct >= 50 ? '#fef3c7' : '#ffe4e6',
                                  color: pct >= 80 ? '#15803d' : pct >= 50 ? '#b45309' : '#be123c' }}
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 200 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ flex: 1 }}>
                                  <LinearProgress
                                    variant="determinate" value={pct}
                                    sx={{ height: 8, borderRadius: 4,
                                      bgcolor: '#f1f5f9',
                                      '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 4 } }}
                                  />
                                </Box>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary', minWidth: 30 }}>
                                  {r.daysPresent}/{totalDays}
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            );
          })()}
        </Box>
      )}

      {/* ── DAILY VIEW ───────────────────────────────────────── */}
      {viewMode === 'daily' && (<Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#e8f5e9', borderLeft: '4px solid #2e7d32' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PeopleIcon sx={{ color: '#2e7d32', fontSize: 36 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Present Today</Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#2e7d32', lineHeight: 1 }}>
                  {summary.totalPresent}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#ffebee', borderLeft: '4px solid #c62828' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PersonOffIcon sx={{ color: '#c62828', fontSize: 36 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Absent Today</Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#c62828', lineHeight: 1 }}>
                  {summary.totalAbsent}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#fff3e0', borderLeft: '4px solid #ef6c00' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <RepeatIcon sx={{ color: '#ef6c00', fontSize: 36 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Re-logins</Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#ef6c00', lineHeight: 1 }}>
                  {summary.totalRelogins}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Controls */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField
          type="date" label="Select Date" value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          InputLabelProps={{ shrink: true }} size="small" sx={{ minWidth: 180 }}
        />
        <TextField
          placeholder="Search name, email, type…" value={search}
          onChange={e => setSearch(e.target.value)} size="small" sx={{ minWidth: 240 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}>
            <MenuItem value="all">All ({allRecords.length})</MenuItem>
            <MenuItem value="present">Present ({summary.totalPresent})</MenuItem>
            <MenuItem value="absent">Absent ({summary.totalAbsent})</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Role</InputLabel>
          <Select value={filterRole} label="Role" onChange={e => setFilterRole(e.target.value)}>
            <MenuItem value="all">All Roles ({allRecords.length})</MenuItem>
            <MenuItem value="employee">FSE ({fseCount})</MenuItem>
            <MenuItem value="teamlead">TL ({tlCount})</MenuItem>
            <MenuItem value="manager">Manager ({managerCount})</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ boxShadow: 3, borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}><TableSortLabel active={sortField === 'userName'} direction={sortField === 'userName' ? sortDir : 'asc'} onClick={() => handleSort('userName')}>Name</TableSortLabel></TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}><TableSortLabel active={sortField === 'userType'} direction={sortField === 'userType' ? sortDir : 'asc'} onClick={() => handleSort('userType')}>Type</TableSortLabel></TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Position</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 700 }}><TableSortLabel active={sortField === 'firstLoginTime'} direction={sortField === 'firstLoginTime' ? sortDir : 'asc'} onClick={() => handleSort('firstLoginTime')}>Login Time</TableSortLabel></TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Last Activity</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Re-logins</TableCell>
                <TableCell sx={{ fontWeight: 700 }}><TableSortLabel active={sortField === 'status'} direction={sortField === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>Status</TableSortLabel></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    <Typography variant="body1" color="text.secondary" sx={{ py: 4 }}>
                      No records found for {selectedDate}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : sorted.map((record, idx) => {
                const isAbsent = record.status === 'absent';
                return (
                  <TableRow key={record._id || `absent-${record.userName || idx}`} hover
                    onClick={record.userType === 'teamlead' ? () => { setTeamModal({ tl: record }); setTeamFilter('all'); } : undefined}
                    sx={{ bgcolor: isAbsent ? 'rgba(198,40,40,0.04)' : 'inherit', opacity: isAbsent ? 0.85 : 1, cursor: record.userType === 'teamlead' ? 'pointer' : 'default' }}
                  >
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{idx + 1}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight={600}>{record.userName || '—'}</Typography>
                        {record.userType === 'teamlead' && <Tooltip title="Click to view team attendance"><Typography variant="caption" sx={{ color: 'primary.main', fontSize: '0.7rem' }}>👥</Typography></Tooltip>}
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>{record.userEmail || '—'}</Typography></TableCell>
                    <TableCell>
                      <Chip label={record.userType} size="small" color={record.userType === 'manager' ? 'secondary' : record.userType === 'teamlead' ? 'warning' : 'primary'} variant="outlined" />
                    </TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontSize: '0.78rem' }}>{record.position || '—'}</Typography></TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontSize: '0.78rem' }}>{record.location || '—'}</Typography></TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontSize: '0.78rem' }}>{record.phone || '—'}</Typography></TableCell>
                    <TableCell>{isAbsent ? <Typography variant="body2" color="text.disabled">—</Typography> : <Typography variant="body2" color="text.secondary">{formatTime(record.firstLoginTime)}</Typography>}</TableCell>
                    <TableCell>{isAbsent ? <Typography variant="body2" color="text.disabled">—</Typography> : <Typography variant="body2" fontWeight="bold">{formatTime(record.lastActivityTime)}</Typography>}</TableCell>
                    <TableCell>
                      {record.duration ? (
                        <Tooltip title={`${record.duration.toFixed(2)} hours`}><Typography variant="body2" fontWeight="bold">{record.duration.toFixed(1)}h</Typography></Tooltip>
                      ) : record.firstLoginTime ? (
                        <Tooltip title="Live — still logged in">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22c55e', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              {(() => { const ms = now - new Date(record.firstLoginTime); const hrs = Math.floor(ms / 3600000); const mins = Math.floor((ms % 3600000) / 60000); return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`; })()}
                            </Typography>
                          </Box>
                        </Tooltip>
                      ) : <Typography variant="body2" color="text.disabled">—</Typography>}
                    </TableCell>
                    <TableCell>{isAbsent ? <Typography variant="body2" color="text.disabled">—</Typography> : record.reloginCount > 0 ? <Chip label={`${record.reloginCount}x`} size="small" color="warning" /> : <Chip label="0x" size="small" color="default" variant="outlined" />}</TableCell>
                    <TableCell><Chip label={record.status} size="small" color={record.status === 'present' ? 'success' : record.status === 'absent' ? 'error' : record.status === 'half-day' ? 'warning' : 'default'} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && sorted.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Showing {sorted.length} of {allRecords.length} employees
        </Typography>
      )}

      {/* Team Modal */}
      {teamModal && (() => {
        const tl = teamModal.tl;
        const tlName = tl.userName || '';
        const teamMembers = allRecords.filter(r => r.userType === 'employee' && (r.reportingManager || '').toLowerCase().trim() === tlName.toLowerCase().trim());
        const presentTeam = teamMembers.filter(r => r.status === 'present');
        const absentTeam  = teamMembers.filter(r => r.status === 'absent');
        return (
          <Dialog open onClose={() => setTeamModal(null)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ background: 'linear-gradient(90deg, #071a0f 0%, #1a5c38 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography fontWeight={800} fontSize={16}>👥 {tlName} — Team Attendance</Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>{tl.location || ''} · {selectedDate}</Typography>
              </Box>
              <IconButton onClick={() => setTeamModal(null)} sx={{ color: '#fff' }} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: tl.status === 'present' ? '#e8f5e9' : '#ffebee', border: `1.5px solid ${tl.status === 'present' ? '#2e7d32' : '#c62828'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography fontWeight={700} fontSize={14}>TL Status: {tlName}</Typography>
                  <Typography variant="caption" color="text.secondary">{tl.userEmail} · {tl.phone || '—'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  {tl.status === 'present' && <><Typography variant="body2" color="text.secondary">Login: {formatTime(tl.firstLoginTime)}</Typography>{tl.duration ? <Chip label={`${tl.duration.toFixed(1)}h`} size="small" color="success" /> : tl.firstLoginTime ? <Chip label={(() => { const ms = now - new Date(tl.firstLoginTime); const hrs = Math.floor(ms / 3600000); const mins = Math.floor((ms % 3600000) / 60000); return hrs > 0 ? `${hrs}h ${mins}m 🟢` : `${mins}m 🟢`; })()} size="small" color="success" /> : null}</>}
                  <Chip label={tl.status} size="small" color={tl.status === 'present' ? 'success' : 'error'} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Chip label={`✅ ${presentTeam.length} Present`} color="success" variant={teamFilter === 'present' ? 'filled' : 'outlined'} clickable onClick={() => setTeamFilter(f => f === 'present' ? 'all' : 'present')} />
                <Chip label={`❌ ${absentTeam.length} Absent`} color="error" variant={teamFilter === 'absent' ? 'filled' : 'outlined'} clickable onClick={() => setTeamFilter(f => f === 'absent' ? 'all' : 'absent')} />
                <Chip label={`Total: ${teamMembers.length}`} variant={teamFilter === 'all' ? 'filled' : 'outlined'} clickable onClick={() => setTeamFilter('all')} />
              </Box>
              {teamMembers.length === 0 ? <Alert severity="info">No FSEs found under {tlName} for this date.</Alert> : (
                <TableContainer component={Paper} sx={{ boxShadow: 1, borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                      <TableRow>{['#', 'Name', 'Location', 'Phone', 'Login Time', 'Duration', 'Status'].map(h => <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>)}</TableRow>
                    </TableHead>
                    <TableBody>
                      {[...presentTeam, ...absentTeam].filter(m => teamFilter === 'all' || m.status === teamFilter).map((member, i) => {
                        const isAbs = member.status === 'absent';
                        return (
                          <TableRow key={member._id || `t-${i}`} hover sx={{ bgcolor: isAbs ? 'rgba(198,40,40,0.04)' : 'inherit' }}>
                            <TableCell sx={{ color: '#888', fontSize: 11 }}>{i + 1}</TableCell>
                            <TableCell><Typography variant="body2" fontWeight={600} fontSize={12}>{member.userName || '—'}</Typography></TableCell>
                            <TableCell sx={{ fontSize: 11 }}>{member.location || '—'}</TableCell>
                            <TableCell sx={{ fontSize: 11 }}>{member.phone || '—'}</TableCell>
                            <TableCell sx={{ fontSize: 11 }}>{isAbs ? '—' : formatTime(member.firstLoginTime)}</TableCell>
                            <TableCell>{member.duration ? <Typography variant="body2" fontWeight="bold" fontSize={11}>{member.duration.toFixed(1)}h</Typography> : member.firstLoginTime ? <Typography variant="body2" color="success.main" fontWeight="bold" fontSize={11}>{(() => { const ms = now - new Date(member.firstLoginTime); const hrs = Math.floor(ms / 3600000); const mins = Math.floor((ms % 3600000) / 60000); return hrs > 0 ? `${hrs}h ${mins}m 🟢` : `${mins}m 🟢`; })()}</Typography> : <Typography variant="body2" color="text.disabled" fontSize={11}>—</Typography>}</TableCell>
                            <TableCell><Chip label={member.status} size="small" color={member.status === 'present' ? 'success' : 'error'} /></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}
      </Box>)} {/* end daily view */}
    </Box>
  );
}
