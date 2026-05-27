const express = require('express');
const router = express.Router();

// GET /api/tl - Get all TLs with Tide BT access
router.get('/', async (req, res) => {
  try {
    const db = req.db; // Use ConnectionManager db from middleware
    
    console.log('🔍 Fetching TLs from TideBT_Access...');
    
    // Get all unique TLs from TideBT_Access collection (tlName field)
    const accessList = await db.collection('TideBT_Access').find({ 
      hasTideBTAccess: true 
    }).toArray();
    
    // Get unique TL names
    const uniqueTLs = [...new Set(accessList.map(a => a.tlName))].filter(Boolean);
    console.log(`✅ Found ${uniqueTLs.length} unique TLs in TideBT_Access:`, uniqueTLs);
    
    // Get TL details from Employees collection
    console.log('🔍 Looking for employees with names:', uniqueTLs);
    
    const employees = await db.collection('Employees').find({ 
      newJoinerName: { $in: uniqueTLs } 
    }).toArray();
    console.log(`✅ Found ${employees.length} matching employees`);
    
    // Build TL list with FSE counts
    const tlList = await Promise.all(uniqueTLs.map(async (tlName) => {
      const emp = employees.find(e => e.newJoinerName === tlName);
      console.log(`Matching ${tlName}:`, emp ? 'Found' : 'Not found');
      
      // Count FSEs under this TL from TideBT_Access
      const fseCount = accessList.filter(a => a.tlName === tlName).length;
      console.log(`FSE count for ${tlName}: ${fseCount}`);
      
      return {
        name: tlName,
        phone: emp?.newJoinerPhone || '',
        email: emp?.newJoinerEmailId || '',
        status: 'active',
        fseCount: fseCount,
        createdAt: null
      };
    }));
    
    res.json({ success: true, tls: tlList, total: tlList.length });
  } catch (error) {
    console.error('❌ Error fetching TLs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tl/:name - Get single TL details with FSEs
router.get('/:name', async (req, res) => {
  try {
    const db = req.db;
    const tlName = req.params.name;
    
    // Get TL from access list
    const access = await db.collection('TideBT_Access').findOne({ 
      name: tlName, 
      role: 'TL' 
    });
    
    if (!access) {
      return res.status(404).json({ success: false, error: 'TL not found' });
    }
    
    // Get TL details from Employees collection
    const employee = await db.collection('Employees').findOne({ 
      newJoinerName: tlName 
    });
    
    // Get FSEs under this TL from Employees collection
    const fseEmployees = await db.collection('Employees').find({ 
      reportingManager: tlName
    }).toArray();
    
    // Get form count
    const formCount = await db.collection('TideBT Form Responses').countDocuments({ 
      employeeName: tlName 
    });
    
    const tlDetails = {
      name: access.name,
      phone: employee?.newJoinerPhone || '',
      email: employee?.newJoinerEmailId || '',
      status: access.status || 'active',
      createdAt: access.createdAt,
      totalForms: formCount,
      fses: fseEmployees.map(f => ({
        name: f.newJoinerName,
        email: f.newJoinerEmailId,
        phone: f.newJoinerPhone
      }))
    };
    
    res.json({ success: true, tl: tlDetails });
  } catch (error) {
    console.error('Error fetching TL details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
