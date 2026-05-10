const express = require('express');
const router = express.Router();
const verifyAuth = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
    listStudents,
    updatePaymentStatus,
    getStudentAnalytics,
} = require('../controllers/studentController');

// All routes require authentication + admin role
router.get('/list', verifyAuth, requireRole(['admin']), listStudents);
router.patch('/:studentId/payment-status', verifyAuth, requireRole(['admin']), updatePaymentStatus);
router.get('/:studentId/analytics', verifyAuth, requireRole(['admin']), getStudentAnalytics);

module.exports = router;
