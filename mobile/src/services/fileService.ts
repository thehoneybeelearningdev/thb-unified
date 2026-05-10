/**
 * File service for TheHoneyBee Mobile App.
 * Port of web/src/services/fileService.js
 * Uses the backend API for file operations.
 */
import { auth } from '../config/firebase';
import { ENV } from '../config/env';
import { Logger } from '../utils/logger';

const TAG = 'FileService';

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const user = auth.currentUser;
    if (!user) return {};
    const token = await user.getIdToken(false);
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

export const fileService = {
  /**
   * Upload a file to the backend.
   */
  uploadFile: async (
    fileUri: string,
    fileName: string,
    mimeType: string,
    batchId: string,
    description: string = '',
    uploadedBy: string = '',
    uploadedByRole: string = '',
    userName: string = ''
  ): Promise<any> => {
    Logger.info(TAG, `Uploading file: ${fileName} to batch ${batchId}`);

    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);
    formData.append('batchId', batchId);
    if (description) formData.append('description', description);
    if (uploadedBy) formData.append('uploadedBy', uploadedBy);
    if (uploadedByRole) formData.append('uploadedByRole', uploadedByRole);
    if (userName) formData.append('userName', userName);

    const headers = await getAuthHeaders();

    const response = await fetch(`${ENV.API_URL}/api/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      Logger.error(TAG, `Upload failed: ${response.status} ${errorText}`);
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    Logger.info(TAG, 'File uploaded successfully', result);
    return result;
  },

  /**
   * Get files by batch/chat ID.
   */
  getFilesByBatch: async (batchId: string): Promise<any> => {
    Logger.debug(TAG, `Fetching files for batch: ${batchId}`);

    const headers = await getAuthHeaders();
    const response = await fetch(`${ENV.API_URL}/api/files/files/batch/${batchId}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    return response.json();
  },

  /**
   * Download a file (returns the download URL).
   */
  getDownloadUrl: (fileId: string): string => {
    return `${ENV.API_URL}/api/files/download/${fileId}`;
  },

  /**
   * Delete a file.
   */
  deleteFile: async (fileId: string): Promise<any> => {
    Logger.info(TAG, `Deleting file: ${fileId}`);

    const headers = await getAuthHeaders();
    const response = await fetch(`${ENV.API_URL}/api/files/files/${fileId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error('Delete failed');
    }

    return response.json();
  },
};
