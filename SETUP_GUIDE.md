# Tide BT Admin Panel - Setup Guide

## ✅ What's Been Created

### Backend (Port 5001)
- **Server**: Express.js with MongoDB connection using **ConnectionManager**
- **Connection Pooling**: Uses the same efficient ConnectionManager pattern as main Tide backend
- **Routes**:
  - `/api/fse` - FSE management
  - `/api/tl` - TL management  
  - `/api/forms` - BT forms
  - `/api/fund-transfer` - Fund transfers (placeholder)

### Frontend (Port 3006)
- **Pages**:
  - Dashboard - Statistics overview
  - FSE Overview - List all FSEs
  - TL Overview - List all TLs with FSE counts
  - BT Forms - View all form submissions
  - Fund Transfer - Placeholder page

## 🔧 Connection Management

**Important**: This backend uses the **same ConnectionManager pattern** as the main Tide backend (port 4000). This ensures:

- ✅ **No connection limit issues** - Efficient connection pooling
- ✅ **Lazy initialization** - Connections created only when needed
- ✅ **Circuit breaker** - Automatic failure recovery
- ✅ **Health monitoring** - Continuous connection health checks
- ✅ **Performance metrics** - Track database performance

Both backends share the same MongoDB database but use separate connection pools managed by their own ConnectionManager instances.

## 🚀 Quick Start

### 1. Install Backend Dependencies
```bash
cd Vegavruddhi-admin-tideBT/backend
npm install
```

### 2. Install Frontend Dependencies
```bash
cd Vegavruddhi-admin-tideBT/frontend
npm install
```

### 3. Start Backend
```bash
cd backend
npm start
```
Backend runs on: http://localhost:5001

### 4. Start Frontend (in new terminal)
```bash
cd frontend
npm start
```
Frontend runs on: http://localhost:3006

## 📊 Database Collections

The backend connects to the same MongoDB database (`CompanyDB`) and uses:

- **TideBT Form Responses** - Form submissions
- **TideBT_Access** - FSE/TL access control
- **Employees** - Employee details
- **TLs** - Team Leader details

## 🎯 Next Steps

You mentioned you'll provide details later for:

1. **FSE Activity** - What activity data to show
2. **TL Activity** - What activity data to show  
3. **Fund Transfer** - Format and functionality
4. **Additional features** - Any other requirements

Just let me know what you need and I'll add it!

## 🔧 Configuration

- Backend port: 5001 (can change in `backend/.env`)
- Frontend port: 3006 (can change in `frontend/.env`)
- MongoDB URI: Already configured in `backend/.env`

## 📝 Notes

- All pages are created with basic structure
- Ready to add more features as you specify
- Uses Material-UI for consistent design
- Responsive layout with sidebar navigation
