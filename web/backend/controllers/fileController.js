/**
 * Retrieves the current database connection instance.
 * Throws an error if the database is not connected.
 * @returns {Db} The MongoDB database instance.
 */
const { getDB } = require('../config/mongodb');
const { GridFSBucket, ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// CREATE - Upload file
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { batchId, description, uploadedBy, uploadedByRole, userName } = req.body; // Add userName here
    const filename = req.file.originalname;
    const fileBuffer = req.file.buffer;
    const fileSize = req.file.size;

    if (!batchId) {
      return res.status(400).json({ error: 'Batch ID is required' });
    }

    const db = getDB();
    const bucket = new GridFSBucket(db);

    // Create file metadata
    const metadata = {
      filename: filename,
      uploadedBy: uploadedBy,
      uploadedByRole: uploadedByRole,
      uploadedByName: userName ,
      batchId: batchId,
      uploadDate: new Date(),
      fileSize: fileSize,
      contentType: req.file.mimetype,
      description: description || '',
      originalName: filename
    };

    // Upload file to GridFS
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: metadata
    });

    uploadStream.end(fileBuffer);

    uploadStream.on('finish', () => {
      res.status(201).json({
        message: 'File uploaded successfully',
        fileId: uploadStream.id,
        filename: filename,
        batchId: batchId,
        uploadDate: metadata.uploadDate,
        fileSize: fileSize,
        uploadedBy: metadata.uploadedBy,
        uploadedByRole: metadata.uploadedByRole,
        uploadedByName: metadata.uploadedByName
      });
    });

    uploadStream.on('error', (error) => {
      res.status(500).json({ error: 'File upload failed' });
    });

  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
};

// READ - Get all files (with optional filtering)
const getAllFiles = async (req, res) => {
  try {
    const { batchId, uploadedBy, page = 1, limit = 20 } = req.query;
    const db = getDB();
    const bucket = new GridFSBucket(db);

    // Build query filter
    let filter = {};
    if (batchId) filter['metadata.batchId'] = batchId;
    if (uploadedBy) filter['metadata.uploadedBy'] = uploadedBy;

    const files = [];
    const cursor = bucket.find(filter).sort({ 'metadata.uploadDate': -1 });

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedCursor = cursor.skip(skip).limit(parseInt(limit));

    for await (const file of paginatedCursor) {
      files.push({
        fileId: file._id,
        filename: file.filename,
        originalName: file.metadata.originalName,
        uploadedBy: file.metadata.uploadedBy,
        uploadedByRole: file.metadata.uploadedByRole,
        uploadedByName: file.metadata.uploadedByName, // Add this
        batchId: file.metadata.batchId,
        uploadDate: file.metadata.uploadDate,
        fileSize: file.metadata.fileSize,
        contentType: file.metadata.contentType,
        description: file.metadata.description
      });
    }

    // Get total count for pagination
    const totalCount = await bucket.find(filter).count();

    res.json({
      files: files,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalFiles: totalCount,
        filesPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
};

  // READ - Get files by batch ID
  const getFilesByBatch = async (req, res) => {
    try {
      const { batchId } = req.params;
      
      if (!batchId) {
        return res.status(400).json({ error: 'Batch ID is required' });
      }
      
      const db = getDB();
      const bucket = new GridFSBucket(db);
      
      const query = { 'metadata.batchId': batchId };
      
      const files = [];
      const cursor = bucket.find(query).sort({ 'metadata.uploadDate': -1 });
      
      let fileCount = 0;
      
      for await (const file of cursor) {
        fileCount++;
        
        files.push({
          fileId: file._id,
          filename: file.filename,
          originalName: file.metadata?.originalName || file.filename,
          uploadedBy: file.metadata?.uploadedBy || 'Unknown',
          uploadedByRole: file.metadata?.uploadedByRole || 'user',
          uploadedByName: file.metadata?.uploadedByName || 'Unknown User',
          uploadDate: file.metadata?.uploadDate || file.uploadDate,
          fileSize: file.metadata?.fileSize || file.length,
          contentType: file.metadata?.contentType || file.contentType || 'application/octet-stream',
          description: file.metadata?.description || ''
        });
      }
      
      const response = {
        success: true,
        batchId: batchId,
        files: files,
        count: files.length,
        timestamp: new Date().toISOString()
      };
      
      res.json(response);
    
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve files',
      message: error.message,
      batchId: req.params.batchId
    });
  }
};

// Helper: determine if a student can access a file's batch or is the uploader
async function studentHasAccessToFile(firebaseDb, userEmail, file, userUid) {
  try {
    // Always allow the uploader to access their own file
    const uploadedByEmail = String(file?.metadata?.uploadedBy || '').toLowerCase();
    if (uploadedByEmail && uploadedByEmail === String(userEmail).toLowerCase()) {
      return true;
    }

    const batchId = file?.metadata?.batchId;
    if (!batchId) return false;

    // If batchId refers to a chat id, authorize based on chat participants
    try {
      const chatDoc = await firebaseDb.collection('chats').doc(String(batchId)).get();
      if (chatDoc.exists) {
        const chatData = chatDoc.data() || {};
        const users = Array.isArray(chatData.users) ? chatData.users.map(v => String(v).toLowerCase()) : [];
        const candidates = [String(userUid || '').toLowerCase(), String(userEmail || '').toLowerCase()];

        if (candidates.some(c => c && users.includes(c))) {
          return true;
        }
        // If chat doc exists but no match, fall through to batch membership to be safe
      }
    } catch{
      
    }

    // Get student document to find their document ID
    let studentSnapshot = await firebaseDb.collection('Students').where('Gmail', '==', userEmail).limit(1).get();
    if (studentSnapshot.empty) {
      studentSnapshot = await firebaseDb.collection('Students').where('email', '==', userEmail).limit(1).get();
    }
    if (studentSnapshot.empty) return false;

    const studentDoc = studentSnapshot.docs[0];
    const studentId = studentDoc.id;
    const studentData = studentDoc.data() || {};

    // Check if student is assigned to this batch by looking in the batches collection
    try {
      const batchesSnapshot = await firebaseDb.collection('batches')
        .where('students', 'array-contains', studentId)
        .get();
      
      
      
      for (const batchDoc of batchesSnapshot.docs) {
        const batchData = batchDoc.data() || {};
        const batchDocId = batchDoc.id;
        
        // Check if this batch matches the file's batchId
        if (String(batchDocId) === String(batchId) || 
            String(batchData.batchId) === String(batchId)) {
          
          return true;
        }
      }
    } catch{
     
    }

    // Fallback: Check legacy batch fields in student document (for backward compatibility)
    const possibleArrays = [
      studentData.batches,
      studentData.assignedBatches,
      studentData.enrolledBatches,
      studentData.batchIds
    ].filter(Array.isArray);

    const arrayHasMatch = possibleArrays.some(arr =>
      arr.map(v => String(v)).some(v => String(v) === String(batchId))
    );
    if (arrayHasMatch) return true;

    // Also check single-value fields that may store one batch id
    const possibleScalars = [studentData.batchSession, studentData.batch, studentData.batchId]
      .filter(Boolean)
      .map(v => String(v));
    if (possibleScalars.includes(String(batchId))) return true;

    return false;
  } catch {
  
    return false;
  }
}

// READ - Get single file by ID
const getFileById = async (req, res) => {
  try {
    const { fileId } = req.params;
    const db = getDB();
    const bucket = new GridFSBucket(db);

    // Validate ObjectId
    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const fileIdObj = new ObjectId(fileId);
    const files = [];
    const cursor = bucket.find({ _id: fileIdObj });

    for await (const file of cursor) {
      files.push(file);
    }

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];

    // SECURITY: Check if user has permission to access this file metadata
    const userEmail = req.user.email.toLowerCase();
    const userRole = req.userRole;

    // Get user role if not already set
    if (!userRole) {
      const { getUserRoleAndName } = require('./authController');
      const roleData = await getUserRoleAndName(userEmail, req.user.name);
      req.userRole = roleData.role.toLowerCase();
    }

    // Admin can access all files
    if (req.userRole === 'admin') {
      // Allow access
    }
    // Teacher can access all files
    else if (req.userRole === 'teacher') {
      // Allow access
    }
    // Student can only access files from their assigned batches (or if they uploaded it)
    else if (req.userRole === 'student') {
      const { db: firebaseDb } = require('../config/firebaseAdmin');
      const allowed = await studentHasAccessToFile(firebaseDb, userEmail, file, req.user.uid);
      if (!allowed) {
        return res.status(403).json({ 
          error: 'Access denied to this file',
          message: 'You do not have access to files from this batch'
        });
      }
    }
    // Unauthorized role
    else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json({
      fileId: file._id,
      filename: file.filename,
      originalName: file.metadata.originalName,
      uploadedBy: file.metadata.uploadedBy,
      uploadedByRole: file.metadata.uploadedByRole,
      uploadedByName: file.metadata.uploadedByName, // Add this
      batchId: file.metadata.batchId,
      uploadDate: file.metadata.uploadDate,
      fileSize: file.metadata.fileSize,
      contentType: file.metadata.contentType,
      description: file.metadata.description
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
};

// READ - Download/Preview file
const downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const db = getDB();
    const bucket = new GridFSBucket(db);

    // Validate ObjectId
    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const fileIdObj = new ObjectId(fileId);
    const files = [];
    const cursor = bucket.find({ _id: fileIdObj });

    for await (const file of cursor) {
      files.push(file);
    }

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];

    // SECURITY: Check if user has permission to access this file
    const userEmail = req.user.email.toLowerCase();
    const userRole = req.userRole;

    // Get user role if not already set
    if (!userRole) {
      const { getUserRoleAndName } = require('./authController');
      const roleData = await getUserRoleAndName(userEmail, req.user.name);
      req.userRole = roleData.role.toLowerCase();
    }

    // Admin can access all files
    if (req.userRole === 'admin') {
      // Allow access
    }
    // Teacher can access all files
    else if (req.userRole === 'teacher') {
      // Allow access
    }
    // Student can only access files from their assigned batches (or if they uploaded it)
    else if (req.userRole === 'student') {
      const { db: firebaseDb } = require('../config/firebaseAdmin');
      const allowed = await studentHasAccessToFile(firebaseDb, userEmail, file, req.user.uid);
      if (!allowed) {
        return res.status(403).json({ 
          error: 'Access denied to this file',
          message: 'You do not have access to files from this batch'
        });
      }
    }
    // Unauthorized role
    else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', file.metadata.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.metadata.originalName}"`);
    res.setHeader('Content-Length', file.metadata.fileSize);

    // Stream the file
    const downloadStream = bucket.openDownloadStream(fileIdObj);
    downloadStream.pipe(res);

  } catch (error) {
    res.status(500).json({ error: 'Failed to download file' });
  }
};

// UPDATE - Update file metadata
const updateFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { description, batchId } = req.body;

    // Validate ObjectId
    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const db = getDB();
    const bucket = new GridFSBucket(db);
    const fileIdObj = new ObjectId(fileId);

    // Find the file first
    const files = [];
    const cursor = bucket.find({ _id: fileIdObj });
    
    for await (const file of cursor) {
      files.push(file);
    }

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];

    // Check if user has permission to update this file
    const userEmail = req.user.email.toLowerCase();
    const userRole = req.userRole;
    
    if (userRole !== 'admin' && userRole !== 'teacher') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // If user is teacher, check if they uploaded the file or are admin
    if (userRole === 'teacher' && file.metadata.uploadedBy !== userEmail) {
      return res.status(403).json({ error: 'Can only update your own files' });
    }

    // Update metadata in the files collection
    const filesCollection = db.collection('fs.files');
    const updateData = {};
    
    if (description !== undefined) updateData['metadata.description'] = description;
    if (batchId !== undefined) updateData['metadata.batchId'] = batchId;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await filesCollection.updateOne(
      { _id: fileIdObj },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      message: 'File updated successfully',
      fileId: fileId,
      updatedFields: Object.keys(updateData)
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to update file' });
  }
};

// DELETE - Delete file
const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    // Validate ObjectId
    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const db = getDB();
    const bucket = new GridFSBucket(db);
    const fileIdObj = new ObjectId(fileId);

    // Find the file first to check permissions
    const files = [];
    const cursor = bucket.find({ _id: fileIdObj });
    
    for await (const file of cursor) {
      files.push(file);
    }

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];

    // Check if user has permission to delete this file
    const userEmail = req.user.email.toLowerCase();
    const userRole = req.userRole;
    
    if (userRole !== 'admin' && userRole !== 'teacher') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // If user is teacher, check if they uploaded the file or are admin
    if (userRole === 'teacher' && file.metadata.uploadedBy !== userEmail) {
      return res.status(403).json({ error: 'Can only delete your own files' });
    }

    // Delete the file from GridFS
    await bucket.delete(fileIdObj);

    res.json({
      message: 'File deleted successfully',
      fileId: fileId,
      filename: file.filename
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

// Get available batches (static list)
const getAvailableBatches = async (req, res) => {
  try {
    // Static list of available batches
    const batches = [
      { id: 'Math101', name: 'Mathematics 101', description: 'Basic mathematics course' },
      { id: 'Science101', name: 'Science 101', description: 'General science course' },
      { id: 'English101', name: 'English 101', description: 'English language course' },
      { id: 'History101', name: 'History 101', description: 'World history course' }
    ];

    res.json({
      batches: batches,
      count: batches.length
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve batches' });
  }
};

module.exports = {
  uploadFile,
  getAllFiles,
  getFilesByBatch,
  getFileById,
  downloadFile,
  updateFile,
  deleteFile,
  getAvailableBatches,
  upload
};