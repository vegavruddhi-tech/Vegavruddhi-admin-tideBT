# Vegavruddhi Tide BT Admin Panel

Admin panel for managing Tide BT operations, FSEs, TLs, and fund transfers.

## Structure

```
Vegavruddhi-admin-tideBT/
├── backend/          # Node.js Express backend (Port 5001)
└── frontend/         # React frontend (Port 3006)
```

## Setup Instructions

### Backend Setup

```bash
cd backend
npm install
npm start
```

Backend will run on http://localhost:5001

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend will run on http://localhost:3006

## Features

- **Dashboard**: Overview statistics
- **FSE Overview**: List all FSEs with Tide BT access
- **TL Overview**: List all TLs with their FSE counts
- **BT Forms**: View all Tide BT form submissions
- **Fund Transfer**: Manage fund transfers (coming soon)

## Database Collections Used

- `TideBT Form Responses` - Form submissions
- `TideBT_Access` - FSE/TL access list
- `Employees` - Employee details
- `TLs` - Team Leader details
