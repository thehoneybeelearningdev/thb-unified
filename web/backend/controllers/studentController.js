/**
 * Student Controller — Admin-only student management & payment status.
 */
const { db: adminDb, admin } = require('../config/firebaseAdmin');
const FieldValue = admin.firestore.FieldValue;

/**
 * GET /api/students/list
 * Returns all students with payment status, batch info.
 */
const listStudents = async (req, res) => {
    try {
        const studentsSnap = await adminDb.collection('Students').get();
        const students = [];

        for (const doc of studentsSnap.docs) {
            const data = doc.data();
            // Resolve batch names
            const batchIds = data.batches || [];
            const batchNames = [];
            for (const bId of batchIds.slice(0, 10)) {
                try {
                    const bDoc = await adminDb.collection('batches').doc(bId).get();
                    if (bDoc.exists) {
                        batchNames.push(bDoc.data().name || bDoc.data().batchName || bId);
                    }
                } catch { }
            }

            students.push({
                id: doc.id,
                name: data.name || data.Name || 'Unknown',
                email: data.Gmail || data.email || '',
                phone: data.phone || data.Phone || '',
                paymentStatus: data.paymentStatus || 'unpaid',
                paymentStatusUpdatedAt: data.paymentStatusUpdatedAt?.toDate?.() || null,
                paymentLastResetAt: data.paymentLastResetAt?.toDate?.() || null,
                batchIds,
                batchNames,
                createdAt: data.createdAt?.toDate?.() || null,
                isActive: data.isActive !== false, // default true
            });
        }

        // Sort by name
        students.sort((a, b) => a.name.localeCompare(b.name));

        res.json({ students, total: students.length });
    } catch (error) {
        console.error('[StudentController] Error listing students:', error);
        res.status(500).json({ error: 'Failed to fetch students', message: error.message });
    }
};

/**
 * PATCH /api/students/:studentId/payment-status
 * Toggle payment status to 'paid' or 'unpaid'.
 */
const updatePaymentStatus = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { status } = req.body;

        if (!['paid', 'unpaid'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be "paid" or "unpaid".' });
        }

        const studentRef = adminDb.collection('Students').doc(studentId);
        const studentDoc = await studentRef.get();

        if (!studentDoc.exists) {
            return res.status(404).json({ error: 'Student not found' });
        }

        await studentRef.update({
            paymentStatus: status,
            paymentStatusUpdatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`[StudentController] Payment status updated: ${studentId} -> ${status}`);
        res.json({
            success: true,
            studentId,
            paymentStatus: status,
            message: `Payment status updated to ${status}`,
        });
    } catch (error) {
        console.error('[StudentController] Error updating payment status:', error);
        res.status(500).json({ error: 'Failed to update payment status', message: error.message });
    }
};

/**
 * GET /api/students/:studentId/analytics
 * Student analytics: payment history, batches, enrollment info.
 */
const getStudentAnalytics = async (req, res) => {
    try {
        const { studentId } = req.params;
        const studentRef = adminDb.collection('Students').doc(studentId);
        const studentDoc = await studentRef.get();

        if (!studentDoc.exists) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const data = studentDoc.data();

        // Get enrollments
        const enrollmentsSnap = await adminDb.collection('enrollments')
            .where('userId', '==', studentId)
            .get();

        const enrollments = enrollmentsSnap.docs.map(d => {
            const e = d.data();
            return {
                id: d.id,
                courseTitle: e.courseTitle || '',
                status: e.status || 'Pending',
                amount: e.amount || 0,
                paidAt: e.paidAt?.toDate?.() || null,
                createdAt: e.createdAt?.toDate?.() || null,
            };
        });

        // Get batch details
        const batchIds = data.batches || [];
        const batches = [];
        for (const bId of batchIds) {
            try {
                const bDoc = await adminDb.collection('batches').doc(bId).get();
                if (bDoc.exists) {
                    const bd = bDoc.data();
                    batches.push({
                        id: bId,
                        name: bd.name || bd.batchName || bId,
                        subject: bd.subject || '',
                        teacherId: bd.teacherId || '',
                    });
                }
            } catch { }
        }

        res.json({
            student: {
                id: studentId,
                name: data.name || data.Name || 'Unknown',
                email: data.Gmail || data.email || '',
                phone: data.phone || '',
                paymentStatus: data.paymentStatus || 'unpaid',
                paymentStatusUpdatedAt: data.paymentStatusUpdatedAt?.toDate?.() || null,
                isActive: data.isActive !== false,
            },
            enrollments,
            batches,
        });
    } catch (error) {
        console.error('[StudentController] Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch student analytics', message: error.message });
    }
};

module.exports = {
    listStudents,
    updatePaymentStatus,
    getStudentAnalytics,
};
