import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, MenuItem, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress, Alert, Grid, Autocomplete, Tooltip,
  LinearProgress
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import * as XLSX from 'xlsx';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function daysLeft(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

// Achievement progress bar component
function AchievementBar({ achieved, target, color = '#1a5c38' }) {
  if (!target || target === 0) return <Typography variant="caption" color="text.disabled">No target</Typography>;
  const pct = Math.min(100, Math.round((achieved / target) * 100));
  const isComplete = pct >= 100;
  return (
    <Box sx={{ minWidth: 120 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
        <Typography variant="caption" fontWeight={700} color={isComplete ? '#2e7d32' : color} fontSize={10}>
          {isComplete ? '🎉 Achieved!' : `${pct}%`}
        </Typography>
        <Typography variant="caption" color="text.secondary" fontSize={9}>
          ₹{(achieved||0).toLocaleString()} / ₹{(target||0).toLocaleString()}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate" value={pct}
        sx={{
          height: 6, borderRadius: 4,
          bgcolor: '#e0e0e0',
          '& .MuiLinearProgress-bar': {
            bgcolor: isComplete ? '#2e7d32' : pct >= 75 ? '#66bb6a' : pct >= 50 ? '#ffa726' : '#ef5350',
            borderRadius: 4,
          }
        }}
      />
    </Box>
  );
}

export default function SetTargets() {
  const [fses, setFses] = useState([]);
  const [tls, setTls] = useState([]);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [achievementLoading, setAchievementLoading] = useState(false);

  // Filter state for targets list
  const [filterMonth, setFilterMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  // Form state
  const [targetFor, setTargetFor] = useState('');
  const [targetRole, setTargetRole] = useState('FSE');
  const [btTarget, setBtTarget] = useState('');
  const [rpTarget, setRpTarget] = useState('');
  const [month, setMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [carryForward, setCarryForward] = useState(0);
  const [carryForwardInfo, setCarryForwardInfo] = useState(null);
  const [cfLoading, setCfLoading] = useState(false);

  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [editId, setEditId] = useState(null);

  useEffect(() => { fetchFSEsTLs(); }, []);
  useEffect(() => { fetchTargets(); }, [filterMonth, filterYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFSEsTLs = async () => {
    try {
      const [fseRes, tlRes] = await Promise.all([
        axios.get(`${API_URL}/fse`),
        axios.get(`${API_URL}/tl`),
      ]);
      setFses(fseRes.data.fses || []);
      setTls(tlRes.data.tls || []);
    } catch (err) { console.error(err); }
  };

  const fetchTargets = async () => {
    setAchievementLoading(true);
    try {
      const params = new URLSearchParams({ withAchievement: 'true' });
      if (filterMonth) params.set('month', filterMonth);
      if (filterYear)  params.set('year', filterYear);
      const res = await axios.get(`${API_URL}/targets?${params}`);
      setTargets(res.data.targets || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setAchievementLoading(false); }
  };

  // Auto-fetch carry forward when person + month + year changes
  const fetchCarryForward = useCallback(async (name, m, y) => {
    if (!name || !m || !y) { setCarryForward(0); setCarryForwardInfo(null); return; }
    setCfLoading(true);
    try {
      const res = await axios.get(`${API_URL}/targets/carry-forward/${encodeURIComponent(name)}?month=${m}&year=${y}`);
      if (res.data.success) {
        setCarryForward(res.data.carryForward || 0);
        setCarryForwardInfo(res.data);
      }
    } catch { setCarryForward(0); setCarryForwardInfo(null); }
    finally { setCfLoading(false); }
  }, []);

  useEffect(() => {
    if (targetFor && month && year && !editId) fetchCarryForward(targetFor, month, year);
  }, [targetFor, month, year, editId, fetchCarryForward]);

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!targetFor || !btTarget || !rpTarget) { setError('All fields required'); return; }
    try {
      if (editId) {
        const res = await axios.put(`${API_URL}/targets/${editId}`, {
          btTarget, rpTarget, startDate, endDate, requestedBy: 'Admin'
        });
        if (res.data.success) { setSuccess('Target updated'); setEditId(null); }
      } else {
        const res = await axios.post(`${API_URL}/targets`, {
          targetFor, targetRole, setBy: 'Admin', setByRole: 'Admin',
          btTarget, rpTarget, month, year, startDate, endDate, carryForward
        });
        if (res.data.success) {
          setSuccess(`Target set for ${targetFor}${carryForward > 0 ? ` (includes ₹${carryForward.toLocaleString()} carry forward)` : ''}`);
        }
      }
      resetForm();
      fetchTargets();
    } catch (err) { setError(err.response?.data?.message || 'Failed'); }
  };

  const handleEdit = (t) => {
    setEditId(t._id);
    setTargetFor(t.targetFor);
    setTargetRole(t.targetRole);
    setBtTarget(t.btTargetOriginal ?? t.btTarget);
    setRpTarget(t.rpTarget);
    setMonth(t.month);
    setYear(t.year);
    setStartDate(t.startDate ? t.startDate.split('T')[0] : '');
    setEndDate(t.endDate ? t.endDate.split('T')[0] : '');
    setCarryForward(0);
    setCarryForwardInfo(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this target?')) return;
    try { await axios.delete(`${API_URL}/targets/${id}`); fetchTargets(); }
    catch (err) { console.error(err); }
  };

  const resetForm = () => {
    setEditId(null); setTargetFor(''); setBtTarget(''); setRpTarget('');
    setStartDate(''); setEndDate(''); setCarryForward(0); setCarryForwardInfo(null);
  };

  const handleExport = () => {
    if (targets.length === 0) return;
    const rows = targets.map(t => ({
      'Person': t.targetFor, 'Role': t.targetRole,
      'BT Target': t.btTarget, 'BT Achieved': t.btAchieved || 0,
      'BT Achievement %': t.btTarget ? Math.round(((t.btAchieved||0)/t.btTarget)*100) + '%' : '–',
      'RP Target': t.rpTarget, 'RP Achieved': t.rpAchieved || 0,
      'Original BT Target': t.btTargetOriginal ?? t.btTarget,
      'Carry Forward': t.carryForward || 0,
      'Month': t.month, 'Year': t.year,
      'Start Date': t.startDate ? new Date(t.startDate).toLocaleDateString('en-IN') : '',
      'End Date': t.endDate ? new Date(t.endDate).toLocaleDateString('en-IN') : '',
      'Set By': t.setBy, 'Set By Role': t.setByRole || 'Admin',
      'Date': t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Targets');
    XLSX.writeFile(wb, `TideBT_Targets_${filterMonth}_${filterYear}.xlsx`);
  };

  const receiverList = targetRole === 'TL' ? tls.map(t => t.name) : fses.map(f => f.name);
  const totalBtTarget = parseFloat(btTarget || 0) + carryForward;

  // Summary stats from current targets list
  const totalTargets = targets.length;
  const achieved100 = targets.filter(t => t.btTarget && (t.btAchieved || 0) >= t.btTarget).length;
  const totalBTAssigned = targets.reduce((s, t) => s + (t.btTarget || 0), 0);
  const totalBTAchieved = targets.reduce((s, t) => s + (t.btAchieved || 0), 0);
  const overallPct = totalBTAssigned > 0 ? Math.round((totalBTAchieved / totalBTAssigned) * 100) : 0;

  if (loading) return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>;

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight={800} color="#1a5c38" gutterBottom>🎯 Set Targets</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>Set BT and Reward Pass targets for TLs and FSEs with deadlines and carry forward</Typography>

      <Grid container spacing={3}>
        {/* Form */}
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: 2, border: '1.5px solid #c8e6c9' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} mb={2}>{editId ? '✏️ Edit Target' : '🆕 New Target'}</Typography>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

              <TextField select fullWidth size="small" label="Target For" value={targetRole}
                onChange={e => { setTargetRole(e.target.value); setTargetFor(''); }} sx={{ mb: 2 }}
                disabled={!!editId}>
                <MenuItem value="FSE">FSE</MenuItem>
                <MenuItem value="TL">TL</MenuItem>
              </TextField>

              <Autocomplete options={receiverList} value={targetFor || null}
                onChange={(_, val) => setTargetFor(val || '')}
                renderInput={(params) => <TextField {...params} label="Select Person *" size="small" />}
                sx={{ mb: 2 }} freeSolo disabled={!!editId} />

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField select size="small" label="Month" value={month}
                  onChange={e => setMonth(e.target.value)} sx={{ flex: 1 }} disabled={!!editId}>
                  {MONTHS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Year" value={year}
                  onChange={e => setYear(e.target.value)} sx={{ width: 100 }} disabled={!!editId}>
                  {[2026, 2025, 2024].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </TextField>
              </Box>

              {/* Carry Forward info */}
              {!editId && targetFor && (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: carryForward > 0 ? '#fff3e0' : '#f5f5f5', borderRadius: 2, border: `1px solid ${carryForward > 0 ? '#ffb74d' : '#e0e0e0'}` }}>
                  {cfLoading ? (
                    <Typography variant="caption" color="text.secondary">Checking previous period...</Typography>
                  ) : carryForward > 0 ? (
                    <Box>
                      <Typography variant="caption" fontWeight={700} color="#e65100">
                        🔄 Carry Forward: ₹{carryForward.toLocaleString()}
                      </Typography>
                      {carryForwardInfo && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Previous target ₹{(carryForwardInfo.prevBtTarget || 0).toLocaleString()} — achieved ₹{(carryForwardInfo.achieved || 0).toLocaleString()} in {carryForwardInfo.prevMonth}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary">No carry forward from previous period</Typography>
                  )}
                </Box>
              )}

              <TextField fullWidth size="small" type="number" label="BT Target (₹)" value={btTarget}
                onChange={e => setBtTarget(e.target.value)} sx={{ mb: 1 }}
                helperText={carryForward > 0 ? `Total effective target: ₹${totalBtTarget.toLocaleString()} (₹${parseFloat(btTarget||0).toLocaleString()} new + ₹${carryForward.toLocaleString()} carry)` : ''} />

              <TextField fullWidth size="small" type="number" label="RP Target (count)" value={rpTarget}
                onChange={e => setRpTarget(e.target.value)} sx={{ mb: 2 }} />

              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                📅 Deadline Period (optional)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField type="date" size="small" label="Start Date" value={startDate}
                  onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
                <TextField type="date" size="small" label="End Date" value={endDate}
                  onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
              </Box>

              <Button variant="contained" fullWidth onClick={handleSubmit}
                sx={{ bgcolor: '#1a5c38', fontWeight: 700, '&:hover': { bgcolor: '#0f3320' } }}>
                {editId ? 'Update Target' : 'Set Target'}
              </Button>
              {editId && (
                <Button fullWidth onClick={resetForm} sx={{ mt: 1, color: '#c62828', fontWeight: 700 }}>Cancel Edit</Button>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Targets List */}
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
            <CardContent>
              {/* Header + filter */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
                <Typography variant="h6" fontWeight={700}>📊 Target Achievement</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField select size="small" label="Month" value={filterMonth}
                    onChange={e => setFilterMonth(e.target.value)} sx={{ width: 120 }}>
                    {MONTHS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </TextField>
                  <TextField select size="small" label="Year" value={filterYear}
                    onChange={e => setFilterYear(e.target.value)} sx={{ width: 85 }}>
                    {[2026, 2025, 2024].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                  </TextField>
                  <Button startIcon={<DownloadIcon />} size="small" onClick={handleExport}
                    variant="outlined" sx={{ color: '#1a5c38', borderColor: '#1a5c38', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
                    Export
                  </Button>
                </Box>
              </Box>

              {/* Summary bar */}
              {targets.length > 0 && (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f5faf7', borderRadius: 2, border: '1px solid #c8e6c9' }}>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Total Targets</Typography>
                      <Typography fontWeight={800} fontSize={18} color="#1a5c38">{totalTargets}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">🎉 Fully Achieved</Typography>
                      <Typography fontWeight={800} fontSize={18} color="#2e7d32">{achieved100}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Total BT Assigned</Typography>
                      <Typography fontWeight={800} fontSize={18} color="#e65100">₹{totalBTAssigned.toLocaleString()}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Total BT Achieved</Typography>
                      <Typography fontWeight={800} fontSize={18} color="#1565c0">₹{totalBTAchieved.toLocaleString()}</Typography>
                    </Box>
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                      <Typography variant="caption" fontWeight={700}>Overall Achievement</Typography>
                      <Typography variant="caption" fontWeight={700} color={overallPct >= 100 ? '#2e7d32' : '#e65100'}>{overallPct}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={Math.min(100, overallPct)}
                      sx={{ height: 8, borderRadius: 4, bgcolor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': { bgcolor: overallPct >= 100 ? '#2e7d32' : overallPct >= 75 ? '#66bb6a' : overallPct >= 50 ? '#ffa726' : '#ef5350', borderRadius: 4 }
                      }} />
                  </Box>
                </Box>
              )}

              {achievementLoading && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}

              {targets.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={4}>No targets for {filterMonth} {filterYear}</Typography>
              ) : (
                <TableContainer sx={{ maxHeight: 500 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, bgcolor: '#f5faf7' } }}>
                        <TableCell>Person</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell align="right">BT Target</TableCell>
                        <TableCell sx={{ minWidth: 150 }}>BT Progress</TableCell>
                        <TableCell align="center">RP</TableCell>
                        <TableCell>Deadline</TableCell>
                        <TableCell>Set By</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {targets.map((t, i) => {
                        const dl = daysLeft(t.endDate);
                        const isAdminSet = !t.setByRole || t.setByRole === 'Admin';
                        const btAchieved = t.btAchieved || 0;
                        const rpAchieved = t.rpAchieved || 0;
                        const btPct = t.btTarget ? Math.min(100, Math.round((btAchieved / t.btTarget) * 100)) : 0;
                        const isComplete = btPct >= 100;
                        return (
                          <TableRow key={i} hover sx={{ bgcolor: isComplete ? '#f0fdf4' : 'inherit' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {isComplete && <CheckCircleIcon sx={{ fontSize: 14, color: '#2e7d32' }} />}
                                {t.targetFor}
                              </Box>
                            </TableCell>
                            <TableCell><Chip label={t.targetRole} size="small" sx={{ fontWeight: 700, fontSize: 10 }} /></TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={700} color="#e65100" fontSize={12}>
                                ₹{(t.btTarget || 0).toLocaleString()}
                              </Typography>
                              {t.carryForward > 0 && (
                                <Typography variant="caption" color="#f57c00" fontSize={9} display="block">
                                  incl. ₹{t.carryForward.toLocaleString()} CF
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <AchievementBar achieved={btAchieved} target={t.btTarget} />
                            </TableCell>
                            <TableCell align="center">
                              <Typography fontWeight={700} color={rpAchieved >= t.rpTarget ? '#2e7d32' : '#7c3aed'} fontSize={12}>
                                {rpAchieved}/{t.rpTarget}
                              </Typography>
                              {rpAchieved >= t.rpTarget && rpAchieved > 0 && (
                                <Typography fontSize={9} color="#2e7d32">✓ Done</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {t.endDate ? (
                                <Box>
                                  <Typography variant="caption" fontSize={10} color="text.secondary">
                                    {new Date(t.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </Typography>
                                  {dl !== null && (
                                    <Chip label={dl < 0 ? 'Expired' : dl === 0 ? 'Today!' : `${dl}d`}
                                      size="small" sx={{ ml: 0.5, fontSize: 9, fontWeight: 700,
                                        bgcolor: dl < 0 ? '#fee2e2' : dl <= 3 ? '#fff3e0' : '#e8f5e9',
                                        color: dl < 0 ? '#b91c1c' : dl <= 3 ? '#e65100' : '#1a4731' }} />
                                  )}
                                </Box>
                              ) : '–'}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {isAdminSet && <Tooltip title="Set by Admin — only Admin can edit"><LockIcon sx={{ fontSize: 12, color: '#9e9e9e' }} /></Tooltip>}
                                <Chip label={t.setBy || 'Admin'} size="small" sx={{ fontSize: 10 }} />
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Button size="small" onClick={() => handleEdit(t)}
                                sx={{ fontSize: 10, minWidth: 'auto', color: '#1565c0' }}>Edit</Button>
                              <Button size="small" onClick={() => handleDelete(t._id)}
                                sx={{ fontSize: 10, minWidth: 'auto', color: '#c62828' }}>Del</Button>
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
      </Grid>
    </Box>
  );
}

// (end of file)