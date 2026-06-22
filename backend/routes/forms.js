const express = require('express');
const router = express.Router();

// GET /api/forms - Get all Tide BT forms
router.get('/', async (req, res) => {
  try {
    const db = req.db; // Use ConnectionManager db from middleware
    const { page = 1, limit = 50, employee, status, formType, fse, tl } = req.query;
    
    // Route to correct collection based on formType
    // Mobikwik withdraw forms are in 'TideBT_Mobikwik' collection (synced from Google Sheet)
    // Regular BT onboarding forms are in 'TideBT Form Responses'
    const collectionName = formType === 'mobikwik-withdraw'
      ? 'TideBT_Mobikwik'
      : 'TideBT Form Responses';
    
    // Build query
    const query = {};
    const andConditions = [];

    if (employee) {
      andConditions.push({
        $or: [
          { employeeName: new RegExp(employee, 'i') },
          { fse: new RegExp(employee, 'i') },
          { tl: new RegExp(employee, 'i') }
        ]
      });
    }

    if (fse) {
      andConditions.push({
        $or: [
          { employeeName: new RegExp(fse, 'i') },
          { fse: new RegExp(fse, 'i') }
        ]
      });
    }

    if (tl) {
      andConditions.push({
        tl: new RegExp(tl, 'i')
      });
    }

    // For TideBT_Mobikwik: filter out blank/invalid rows (merchantName empty or withdrawAmount = 0)
    if (collectionName === 'TideBT_Mobikwik') {
      andConditions.push({ merchantName: { $exists: true, $ne: '' } });
      andConditions.push({ withdrawAmount: { $gt: 0 } });
    }
    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    if (status) query.status = status;
    // Only add formType filter for TideBT Form Responses collection
    // TideBT_Mobikwik already contains only mobikwik-withdraw docs
    if (formType && collectionName === 'TideBT Form Responses') {
      if (formType === 'bt-forms') {
        query.formType = { $ne: 'mobikwik-withdraw' };
      } else {
        query.formType = formType;
      }
    }
    
    // Get forms with pagination
    const forms = await db.collection(collectionName)
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .toArray();
    
    const total = await db.collection(collectionName).countDocuments(query);
    
    // For TideBT_Mobikwik: enrich employeeName from Employees collection using employeeEmail
    let enrichedForms = forms;
    if (collectionName === 'TideBT_Mobikwik') {
      const emailsNeedingLookup = [...new Set(
        forms.filter(f => !f.employeeName && f.employeeEmail).map(f => f.employeeEmail)
      )];
      if (emailsNeedingLookup.length > 0) {
        const employees = await db.collection('Employees').find({
          $or: [
            { newJoinerEmailId: { $in: emailsNeedingLookup } },
            { email: { $in: emailsNeedingLookup } }
          ]
        }, { projection: { newJoinerName: 1, newJoinerEmailId: 1, email: 1, _id: 0 } }).toArray();
        const emailToName = {};
        employees.forEach(e => {
          if (e.newJoinerEmailId) emailToName[e.newJoinerEmailId.toLowerCase()] = e.newJoinerName;
          if (e.email) emailToName[e.email.toLowerCase()] = e.newJoinerName;
        });
        enrichedForms = forms.map(f => {
          if (!f.employeeName && f.employeeEmail) {
            const name = emailToName[f.employeeEmail.toLowerCase()];
            if (name) return { ...f, employeeName: name };
          }
          return f;
        });
      }
    }
    
    res.json({ 
      success: true, 
      forms: enrichedForms, 
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/forms/stats - Get form statistics
router.get('/stats', async (req, res) => {
  try {
    const db = req.db;
    
    const totalForms = await db.collection('TideBT Form Responses').countDocuments();
    
    // Count by status
    const statusCounts = await db.collection('TideBT Form Responses').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    
    // Count by employee
    const topEmployees = await db.collection('TideBT Form Responses').aggregate([
      { $group: { _id: { $ifNull: [ '$employeeName', '$fse' ] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    res.json({ 
      success: true, 
      stats: {
        totalForms,
        byStatus: statusCounts,
        topEmployees
      }
    });
  } catch (error) {
    console.error('Error fetching form stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/forms/by-employee/:name - Get all forms by a specific employee
router.get('/by-employee/:name', async (req, res) => {
  try {
    const db = req.db;
    const employeeName = decodeURIComponent(req.params.name);
    
    const forms = await db.collection('TideBT Form Responses')
      .find({
        $or: [
          { employeeName: new RegExp(`^${employeeName}$`, 'i') },
          { fse: new RegExp(`^${employeeName}$`, 'i') },
          { tl: new RegExp(`^${employeeName}$`, 'i') }
        ]
      })
      .sort({ createdAt: -1 })
      .toArray();
    
    const total = forms.length;
    const onboarded = forms.filter(f => f.onboardingStatus === 'Completed').length;
    const pending = forms.filter(f => f.onboardingStatus === 'Pending/Hold').length;
    const readyForOnboarding = forms.filter(f => f.merchantOpinion === 'Ready For Onboarding').length;
    const notInterested = forms.filter(f => f.merchantOpinion === 'Not interested').length;
    
    res.json({ 
      success: true, 
      forms,
      total,
      stats: {
        onboarded,
        pending,
        readyForOnboarding,
        notInterested
      }
    });
  } catch (error) {
    console.error('Error fetching forms by employee:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
