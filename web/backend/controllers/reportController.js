/**
 * Report Controller — Teacher daily/weekly reports & admin analytics.
 */
const { db: adminDb, admin } = require('../config/firebaseAdmin');
const FieldValue = admin.firestore.FieldValue;

/**
 * POST /api/reports/daily
 * Submit a daily class report (teacher only).
 */
const submitDailyReport = async (req, res) => {
    try {
        const {
            batchId, batchName, className, startTime, endTime,
            studentsPresent, studentsAbsent, topicsCovered, comments, classType
        } = req.body;

        if (!batchId || !className || !startTime || !endTime) {
            return res.status(400).json({
                error: 'Missing required fields: batchId, className, startTime, endTime',
            });
        }

        // Get teacher info from auth
        const email = req.user.email?.toLowerCase();
        let teacherName = 'Teacher';
        let teacherId = '';
        try {
            const teacherSnap = await adminDb.collection('Teacher').where('Gmail', '==', email).limit(1).get();
            if (!teacherSnap.empty) {
                const tData = teacherSnap.docs[0].data();
                teacherName = tData.name || tData.Name || 'Teacher';
                teacherId = teacherSnap.docs[0].id;
            }
        } catch { }

        const reportData = {
            teacherId,
            teacherName,
            teacherEmail: email,
            batchId,
            batchName: batchName || '',
            classType: classType || 'batch',
            reportType: 'daily',
            className,
            startTime,
            endTime,
            studentsPresent: Array.isArray(studentsPresent) ? studentsPresent : [],
            studentsAbsent: Array.isArray(studentsAbsent) ? studentsAbsent : [],
            topicsCovered: topicsCovered || '',
            comments: comments || '',
            reportDate: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
        };

        const docRef = await adminDb.collection('teacherReports').add(reportData);

        console.log(`[ReportController] Daily report submitted: ${docRef.id} by ${teacherName}`);
        res.status(201).json({
            success: true,
            reportId: docRef.id,
            message: 'Daily report submitted successfully',
        });
    } catch (error) {
        console.error('[ReportController] Error submitting daily report:', error);
        res.status(500).json({ error: 'Failed to submit daily report', message: error.message });
    }
};

/**
 * POST /api/reports/weekly
 * Submit a weekly report (teacher only).
 */
const submitWeeklyReport = async (req, res) => {
    try {
        const { batchId, batchName, reportText, classType } = req.body;

        if (!batchId || !reportText) {
            return res.status(400).json({ error: 'Missing required fields: batchId, reportText' });
        }

        const email = req.user.email?.toLowerCase();
        let teacherName = 'Teacher';
        let teacherId = '';
        try {
            const teacherSnap = await adminDb.collection('Teacher').where('Gmail', '==', email).limit(1).get();
            if (!teacherSnap.empty) {
                const tData = teacherSnap.docs[0].data();
                teacherName = tData.name || tData.Name || 'Teacher';
                teacherId = teacherSnap.docs[0].id;
            }
        } catch { }

        const reportData = {
            teacherId,
            teacherName,
            teacherEmail: email,
            batchId,
            batchName: batchName || '',
            classType: classType || 'batch',
            reportType: 'weekly',
            reportText,
            reportDate: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
        };

        const docRef = await adminDb.collection('teacherReports').add(reportData);

        console.log(`[ReportController] Weekly report submitted: ${docRef.id} by ${teacherName}`);
        res.status(201).json({
            success: true,
            reportId: docRef.id,
            message: 'Weekly report submitted successfully',
        });
    } catch (error) {
        console.error('[ReportController] Error submitting weekly report:', error);
        res.status(500).json({ error: 'Failed to submit weekly report', message: error.message });
    }
};

/**
 * GET /api/reports/list
 * List all reports (admin only). Optional query filters: ?type=daily|weekly&batchId=xxx&teacherId=xxx
 */
const listReports = async (req, res) => {
    try {
        const { type, batchId, teacherId } = req.query;
        let queryRef = adminDb.collection('teacherReports');

        // If teacher, only let them see their own reports.
        // We drop orderBy here to avoid needing a Firestore composite index (teacherEmail + createdAt).
        if (req.userRole === 'teacher') {
            const email = req.user.email?.toLowerCase();
            queryRef = queryRef.where('teacherEmail', '==', email);
        } else {
            queryRef = queryRef.orderBy('createdAt', 'desc');
        }

        // Firestore doesn't support multiple inequality/range filters together,
        // so we apply them in-memory for flexibility
        const snap = await queryRef.limit(200).get();

        let reports = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                reportDate: data.reportDate?.toDate?.() || null,
                createdAt: data.createdAt?.toDate?.() || null,
            };
        });

        // Manually sort since we may have dropped orderBy for teachers
        reports.sort((a, b) => {
            if (!a.createdAt) return 1;
            if (!b.createdAt) return -1;
            return b.createdAt.getTime() - a.createdAt.getTime();
        });

        // Apply filters
        if (type) reports = reports.filter(r => r.reportType === type);
        if (batchId) reports = reports.filter(r => r.batchId === batchId);
        if (teacherId) reports = reports.filter(r => r.teacherId === teacherId);

        res.json({ reports, total: reports.length });
    } catch (error) {
        console.error('[ReportController] Error listing reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports', message: error.message });
    }
};

/**
 * GET /api/reports/batch/:batchId
 * Reports for a specific batch.
 */
const getReportsByBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const snap = await adminDb.collection('teacherReports')
            .where('batchId', '==', batchId)
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();

        const reports = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                reportDate: data.reportDate?.toDate?.() || null,
                createdAt: data.createdAt?.toDate?.() || null,
            };
        });

        res.json({ reports, total: reports.length });
    } catch (error) {
        console.error('[ReportController] Error fetching batch reports:', error);
        res.status(500).json({ error: 'Failed to fetch batch reports', message: error.message });
    }
};

module.exports = {
    submitDailyReport,
    submitWeeklyReport,
    listReports,
    getReportsByBatch,
};
