import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DateFilter from '../components/DateFilter';

export default function Reports() {
  const [tab, setTab] = useState(0);
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('');

  return (
    <Box p={3}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" fontWeight={700}>Reports</Typography>
        <Button startIcon={<RefreshIcon />} onClick={() => window.location.reload()} variant="outlined"
          sx={{ color: '#1a5c38', borderColor: '#1a5c38', fontWeight: 700, '&:hover': { bgcolor: '#e6f4ea' } }}>
          Refresh
        </Button>
      </Box>

      <DateFilter
        dateFilter={dateFilter} setDateFilter={setDateFilter}
        fromDate={fromDate} setFromDate={setFromDate}
        toDate={toDate} setToDate={setToDate}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
      />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', fontSize: '0.9rem' },
          '& .MuiTabs-indicator': { bgcolor: '#1a5c38', height: 3 }
        }}
      >
        <Tab label="Daily Report" />
        <Tab label="Weekly Report" />
        <Tab label="Monthly Report" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Typography variant="h6" fontWeight={600} mb={1}>Daily Report</Typography>
          <Typography variant="body2" color="text.secondary">Coming soon...</Typography>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Typography variant="h6" fontWeight={600} mb={1}>Weekly Report</Typography>
          <Typography variant="body2" color="text.secondary">Coming soon...</Typography>
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Typography variant="h6" fontWeight={600} mb={1}>Monthly Report</Typography>
          <Typography variant="body2" color="text.secondary">Coming soon...</Typography>
        </Box>
      )}
    </Box>
  );
}
