import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, MenuItem, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress, Alert, Grid, Autocomplete
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import * as XLSX from 'xlsx';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function SetTargets() {
  const [fses, setFses] = useState([]);
  const [tls, setTls] = useState([]);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [targetFor, setTargetFor] = useState('');
  const [targetRole, setTargetRole] = useState('FSE');
  const [btTarget, setBtTarget] = useState('');
  const [rpTarget, setRpTarget] = useState('');
  const [month, setMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [year, setYear] = useState(new Date().getFullYear());
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [editId, setEditId] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [fseRes, tlRes, targetsRes] = await Promise.all([
        axios.get(`${API_URL}/fse`),
        axios.get(`${API_URL}/tl`),
        axios.get(`${API_URL}/targets`)
      ]);
      setFses(fseRes.data.fses || []);
      setTls(tlRes.data.tls || []);
      setTargets(targetsRes.data.targets || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!targetFor || !btTarget || !rpTarget) { setError('All fields required'); return; }

    try {
      if (editId) {
        // Update existing
        const res = await axios.put(`${API_URL}/targets/${editId}`, { btTarget, rpTarget });
        if (res.data.success) { setSuccess('Target updated'); setEditId(null); }
      } else {
        // Create new
        const res = await axios.post(`${API_URL}/targets`, {
          targetFor, targetRole, setBy: 'Admin', setByRole: 'Admin',
          btTarget, rpTarget, month, year
        });
        if (res.data.success) { setSuccess(`Target set for ${targetFor}`); }
      }
      setTargetFor(''); setBtTarget(''); setRpTarget('');
      fetchData();
    } catch (err) { setError(err.response?.data?.message || 'Failed'); }
  };

  const handleEdit = (t) => {
    setEditId(t._id);
    setTargetFor(t.targetFor);
    setTargetRole(t.targetRole);
    setBtTarget(t.btTarget);
    setRpTarget(t.rpTarget);
    setMonth(t.month);
    setYear(t.year);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this target?')) return;
    try {
      await axios.delete(`${API_URL}/targets/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleExport = () => {
    if (targets.length === 0) return;
    const rows = targets.map(t => ({
      'Person': t.targetFor,
      'Role': t.targetRole,
      'BT Target': t.btTarget,
      'RP Target': t.rpTarget,
      'Month': t.month,
      'Year': t.year,
      'Set By': t.setBy,
      'Date': t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Targets');
    XLSX.writeFile(wb, `TideBT_Targets_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const receiverList = targetRole === 'TL' ? tls.map(t => t.name) : fses.map(f => f.name);

  if (loading) return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>;

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight={800} color="#1a5c38" gutterBottom>🎯 Set Targets</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>Set BT and Reward Pass targets for TLs and FSEs</Typography>

      <Grid container spacing={3}>
        {/* Form */}
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: 2, border: '1.5px solid #c8e6c9' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} mb={2}>New Target</Typography>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

              <TextField select fullWidth size="small" label="Target For" value={targetRole}
                onChange={e => { setTargetRole(e.target.value); setTargetFor(''); }} sx={{ mb: 2 }}>
                <MenuItem value="FSE">FSE</MenuItem>
                <MenuItem value="TL">TL</MenuItem>
              </TextField>

              <Autocomplete options={receiverList} value={targetFor || null}
                onChange={(_, val) => setTargetFor(val || '')}
                renderInput={(params) => <TextField {...params} label="Select Person *" size="small" />}
                sx={{ mb: 2 }} freeSolo />

              <TextField fullWidth size="small" type="number" label="BT Target (₹)" value={btTarget}
                onChange={e => setBtTarget(e.target.value)} sx={{ mb: 2 }} />

              <TextField fullWidth size="small" type="number" label="RP Target (count)" value={rpTarget}
                onChange={e => setRpTarget(e.target.value)} sx={{ mb: 2 }} />

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField select size="small" label="Month" value={month}
                  onChange={e => setMonth(e.target.value)} sx={{ flex: 1 }}>
                  {MONTHS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Year" value={year}
                  onChange={e => setYear(e.target.value)} sx={{ width: 100 }}>
                  {[2026, 2025, 2024].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </TextField>
              </Box>

              <Button variant="contained" fullWidth onClick={handleSubmit}
                sx={{ bgcolor: '#1a5c38', fontWeight: 700, '&:hover': { bgcolor: '#0f3320' } }}>
                {editId ? 'Update Target' : 'Set Target'}
              </Button>
              {editId && (
                <Button fullWidth onClick={() => { setEditId(null); setTargetFor(''); setBtTarget(''); setRpTarget(''); }}
                  sx={{ mt: 1, color: '#c62828', fontWeight: 700 }}>Cancel Edit</Button>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Targets List */}
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700}>Current Targets</Typography>
                <Button startIcon={<DownloadIcon />} size="small" onClick={handleExport}
                  variant="outlined" sx={{ color: '#1a5c38', borderColor: '#1a5c38', fontWeight: 700, fontSize: 11 }}>
                  Export Excel
                </Button>
              </Box>
              {targets.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={4}>No targets set yet</Typography>
              ) : (
                <TableContainer sx={{ maxHeight: 500 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11 } }}>
                        <TableCell>Person</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell align="center">BT Target</TableCell>
                        <TableCell align="center">RP Target</TableCell>
                        <TableCell>Month</TableCell>
                        <TableCell>Set By</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {targets.map((t, i) => (
                        <TableRow key={i} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{t.targetFor}</TableCell>
                          <TableCell><Chip label={t.targetRole} size="small" sx={{ fontWeight: 700, fontSize: 10 }} /></TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#e65100' }}>₹{t.btTarget?.toLocaleString()}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#7c3aed' }}>{t.rpTarget}</TableCell>
                          <TableCell>{t.month} {t.year}</TableCell>
                          <TableCell><Chip label={t.setBy} size="small" sx={{ fontSize: 10 }} /></TableCell>
                          <TableCell align="center">
                            <Button size="small" onClick={() => handleEdit(t)} sx={{ fontSize: 10, minWidth: 'auto', color: '#1565c0' }}>Edit</Button>
                            <Button size="small" onClick={() => handleDelete(t._id)} sx={{ fontSize: 10, minWidth: 'auto', color: '#c62828' }}>Delete</Button>
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
      </Grid>
    </Box>
  );
}
