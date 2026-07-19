const express = require('express');
const router = express.Router();
const verifyAuth = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
    listStudents,
    updatePaymentStatus,
    getStudentAnalytics,
    addStudent,
} = require('../controllers/studentController');

// All routes require authentication + admin role
router.get('/list', verifyAuth, requireRole(['admin']), listStudents);
router.post('/add', verifyAuth, requireRole(['admin']), addStudent);
router.patch('/:studentId/payment-status', verifyAuth, requireRole(['admin']), updatePaymentStatus);
router.get('/:studentId/analytics', verifyAuth, requireRole(['admin']), getStudentAnalytics);

module.exports = router;
