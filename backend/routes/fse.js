const express = require('express');
const router = express.Router();

// GET /api/fse - Get all FSEs with Tide BT access
router.get('/', async (req, res) => {
  try {
    const db = req.db; // Use ConnectionManager db from middleware
    
    console.log('🔍 Fetching FSEs from TideBT_Access...');
    
    // Get all unique FSEs from TideBT_Access collection (fseName field)
    const accessList = await db.collection('TideBT_Access').find({ 
      hasTideBTAccess: true 
    }).toArray();
    
    // Get unique FSE names
    const uniqueFSEs = [...new Set(accessList.map(a => a.fseName))].filter(Boolean);
    console.log(`✅ Found ${uniqueFSEs.length} unique FSEs in TideBT_Access:`, uniqueFSEs);
    
    // Get employee details from Employees collection
    console.log('🔍 Looking for employees with names:', uniqueFSEs);
    
    const employees = await db.collection('Employees').find({ 
      newJoinerName: { $in: uniqueFSEs } 
    }).toArray();
    console.log(`✅ Found ${employees.length} matching employees`);
    
    // Build FSE list with details
    const fseList = uniqueFSEs.map(fseName => {
      const emp = employees.find(e => e.newJoinerName === fseName);
      const accessRecord = accessList.find(a => a.fseName === fseName);
      console.log(`Matching ${fseName}:`, emp ? 'Found' : 'Not found');
      
      return {
        name: fseName,
        phone: emp?.newJoinerPhone || '',
        email: emp?.newJoinerEmailId || '',
        reportingManager: accessRecord?.tlName || emp?.reportingManager || '',
        status: 'active',
        createdAt: accessRecord?.createdAt || null
      };
    });
    
    res.json({ success: true, fses: fseList, total: fseList.length });
  } catch (error) {
    console.error('❌ Error fetching FSEs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/fse/:name - Get single FSE details
router.get('/:name', async (req, res) => {
  try {
    const db = req.db;
    const fseName = req.params.name;
    
    // Get FSE from access list
    const access = await db.collection('TideBT_Access').findOne({ 
      name: fseName, 
      role: 'FSE' 
    });
    
    if (!access) {
      return res.status(404).json({ success: false, error: 'FSE not found' });
    }
    
    // Get employee details
    const employee = await db.collection('Employees').findOne({ 
      newJoinerName: fseName 
    });
    
    // Get form count
    const formCount = await db.collection('TideBT Form Responses').countDocuments({ 
      employeeName: fseName 
    });
    
    const fseDetails = {
      name: access.name,
      phone: employee?.newJoinerPhone || '',
      email: employee?.newJoinerEmailId || '',
      reportingManager: employee?.reportingManager || '',
      status: access.status || 'active',
      createdAt: access.createdAt,
      totalForms: formCount
    };
    
    res.json({ success: true, fse: fseDetails });
  } catch (error) {
    console.error('Error fetching FSE details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
