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
    const tlName = decodeURIComponent(req.params.name);
    
    // Get FSEs under this TL from TideBT_Access
    const accessList = await db.collection('TideBT_Access').find({ 
      tlName: tlName,
      hasTideBTAccess: true 
    }).toArray();
    
    const fseNames = [...new Set(accessList.map(a => a.fseName))].filter(Boolean);
    
    // Get employee details
    const employees = await db.collection('Employees').find({ 
      newJoinerName: { $in: fseNames } 
    }).toArray();
    
    // Get forms for all FSEs under this TL
    const forms = await db.collection('TideBT Form Responses')
      .find({ employeeName: { $in: fseNames } })
      .sort({ createdAt: -1 })
      .toArray();
    
    // Build FSE list
    const fses = fseNames.map(fseName => {
      const emp = employees.find(e => e.newJoinerName === fseName);
      const fseFormCount = forms.filter(f => f.employeeName === fseName).length;
      return {
        name: fseName,
        phone: emp?.newJoinerPhone || '',
        email: emp?.newJoinerEmailId || '',
        formCount: fseFormCount
      };
    });
    
    res.json({ 
      success: true, 
      tlName,
      fses,
      forms,
      totalFSEs: fses.length,
      totalForms: forms.length
    });
  } catch (error) {
    console.error('Error fetching TL details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
