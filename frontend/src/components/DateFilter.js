import React from 'react';
import { Box, Button, TextField, MenuItem, Autocomplete } from '@mui/material';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function DateFilter({
  dateFilter,
  setDateFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  selectedTlFilter,
  setSelectedTlFilter,
  selectedFseFilter,
  setSelectedFseFilter,
  tls = [],
  fses = []
}) {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);

  // Filter FSE options based on selected TL reporting manager
  // Uses partial match to handle "Dheeraj" matching "Dheeraj Anand" etc.
  const filteredFses = fses.filter(f => {
    if (!selectedTlFilter) return true;
    const tlLower = selectedTlFilter.toLowerCase();
    const rm = (f.reportingManager || '').toLowerCase();
    return rm === tlLower || rm.includes(tlLower) || tlLower.includes(rm.split(' ')[0]);
  });

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
      {['all', 'today', 'month'].map(f => (
        <Button key={f} size="small"
          variant={dateFilter === f ? 'contained' : 'outlined'}
          onClick={() => { 
            setDateFilter(f); 
            setFromDate(''); 
            setToDate(''); 
            if (f === 'all') { setSelectedYear(''); setSelectedMonth(''); }
            if (f === 'month') { 
              setSelectedYear(new Date().getFullYear()); 
              setSelectedMonth(new Date().toLocaleString('en-US', { month: 'long' })); 
            }
          }}
          sx={{
            fontWeight: 700, textTransform: 'capitalize',
            bgcolor: dateFilter === f ? '#1a5c38' : 'transparent',
            borderColor: '#1a5c38', color: dateFilter === f ? '#fff' : '#1a5c38',
            '&:hover': { bgcolor: dateFilter === f ? '#0f3320' : '#e6f4ea' }
          }}>
          {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'This Month'}
        </Button>
      ))}

      <TextField size="small" type="date" label="From" value={fromDate}
        onChange={e => { setFromDate(e.target.value); setDateFilter('custom'); }}
        InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
      <TextField size="small" type="date" label="To" value={toDate}
        onChange={e => { setToDate(e.target.value); setDateFilter('custom'); }}
        InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />

      <TextField select size="small" label="Year" value={selectedYear}
        onChange={e => setSelectedYear(e.target.value)}
        sx={{ minWidth: 100 }}>
        <MenuItem value="">All Years</MenuItem>
        {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
      </TextField>

      <TextField select size="small" label="Month" value={selectedMonth}
        onChange={e => setSelectedMonth(e.target.value)}
        sx={{ minWidth: 120 }}>
        <MenuItem value="">All</MenuItem>
        {MONTHS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
      </TextField>

      {tls && tls.length > 0 && setSelectedTlFilter && (
        <TextField select size="small" label="TL" value={selectedTlFilter || ''}
          onChange={e => {
            setSelectedTlFilter(e.target.value);
            if (setSelectedFseFilter) setSelectedFseFilter('');
          }}
          sx={{ minWidth: 130 }}>
          <MenuItem value="">All TLs</MenuItem>
          {tls.map(t => (
            <MenuItem key={t.name || t} value={t.name || t}>
              {t.name || t}
            </MenuItem>
          ))}
        </TextField>
      )}

      {fses && fses.length > 0 && setSelectedFseFilter && (
        <Autocomplete
          options={filteredFses.map(f => f.name || f)}
          value={selectedFseFilter || null}
          onChange={(_, val) => setSelectedFseFilter(val || '')}
          size="small"
          sx={{ minWidth: 180 }}
          renderInput={(params) => (
            <TextField {...params} label="FSE" size="small"
              sx={{ '& .MuiOutlinedInput-root': { '&.Mui-focused fieldset': { borderColor: '#1a5c38' } } }} />
          )}
        />
      )}

      {(dateFilter !== 'all' || fromDate || toDate || selectedMonth || selectedTlFilter || selectedFseFilter) && (
        <Button size="small" variant="outlined" color="error"
          onClick={() => {
            setDateFilter('all');
            setFromDate('');
            setToDate('');
            setSelectedMonth('');
            setSelectedYear('');
            if (setSelectedTlFilter) setSelectedTlFilter('');
            if (setSelectedFseFilter) setSelectedFseFilter('');
          }}
          sx={{ fontWeight: 700 }}>
          Reset
        </Button>
      )}
    </Box>
  );
}
