const express = require('express');
const router = express.Router();
const verifyAuth = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
    submitDailyReport,
    submitWeeklyReport,
    listReports,
    getReportsByBatch,
} = require('../controllers/reportController');

// Teacher can submit reports
router.post('/daily', verifyAuth, requireRole(['teacher', 'admin']), submitDailyReport);
router.post('/weekly', verifyAuth, requireRole(['teacher', 'admin']), submitWeeklyReport);

// Admin and Teachers can view reports (teachers only see their own, handled in controller)
router.get('/list', verifyAuth, requireRole(['admin', 'teacher']), listReports);
router.get('/batch/:batchId', verifyAuth, requireRole(['admin', 'teacher']), getReportsByBatch);

module.exports = router;
