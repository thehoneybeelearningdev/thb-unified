/**
 * Production-grade API client for TheHoneyBee Mobile App.
 * Wraps fetch with Firebase ID token auth, logging, retries, and error handling.
 */
import { auth } from '../config/firebase';
import { ENV } from '../config/env';
import { Logger } from '../utils/logger';

const TAG = 'API';

export interface ApiError {
  status: number;
  message: string;
  data?: any;
}

export class ApiRequestError extends Error {
  status: number;
  data?: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Get the current Firebase ID token for authenticated requests.
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken(false);
  } catch (error) {
    Logger.warn(TAG, 'Failed to get auth token', error);
    return null;
  }
}

/**
 * Core API request function with logging, auth, and retries.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
    isFormData?: boolean;
    retries?: number;
    requiresAuth?: boolean;
  } = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    isFormData = false,
    retries = 2,
    requiresAuth = true,
  } = options;

  const url = `${ENV.API_URL}${endpoint}`;
  const requestHeaders: Record<string, string> = { ...headers };

  // Add auth token
  if (requiresAuth) {
    const token = await getAuthToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  // Add content type for JSON bodies
  if (body && !isFormData) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  // Log the request
  Logger.apiRequest(method, url, requestHeaders, isFormData ? '[FormData]' : body);

  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        Logger.info(TAG, `Retry attempt ${attempt}/${retries} for ${method} ${endpoint}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }

      const fetchOptions: RequestInit = {
        method,
        headers: requestHeaders,
      };

      if (body) {
        fetchOptions.body = isFormData ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      const durationMs = Date.now() - startTime;

      // Try to parse response body
      let responseData: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else if (contentType.includes('text/')) {
        responseData = await response.text();
      } else {
        responseData = await response.blob();
      }

      // Log the response
      Logger.apiResponse(method, url, response.status, durationMs, 
        typeof responseData === 'object' ? responseData : String(responseData).substring(0, 200)
      );

      if (!response.ok) {
        throw new ApiRequestError(
          response.status,
          responseData?.error || responseData?.message || `HTTP ${response.status}`,
          responseData
        );
      }

      return responseData as T;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on 4xx errors (client errors)
      if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Don't retry if it's the last attempt
      if (attempt >= retries) {
        break;
      }

      Logger.warn(TAG, `Request failed, will retry: ${(error as Error).message}`);
    }
  }

  const durationMs = Date.now() - startTime;
  Logger.apiResponse(method, url, 0, durationMs, lastError?.message);
  throw lastError || new Error('Request failed');
}

/** Shorthand for GET requests */
export const api = {
  get: <T = any>(endpoint: string, requiresAuth = true) =>
    apiRequest<T>(endpoint, { method: 'GET', requiresAuth }),

  post: <T = any>(endpoint: string, body?: any, requiresAuth = true) =>
    apiRequest<T>(endpoint, { method: 'POST', body, requiresAuth }),

  put: <T = any>(endpoint: string, body?: any, requiresAuth = true) =>
    apiRequest<T>(endpoint, { method: 'PUT', body, requiresAuth }),

  patch: <T = any>(endpoint: string, body?: any, requiresAuth = true) =>
    apiRequest<T>(endpoint, { method: 'PATCH', body, requiresAuth }),

  delete: <T = any>(endpoint: string, requiresAuth = true) =>
    apiRequest<T>(endpoint, { method: 'DELETE', requiresAuth }),

  upload: <T = any>(endpoint: string, formData: FormData, requiresAuth = true) =>
    apiRequest<T>(endpoint, { method: 'POST', body: formData, isFormData: true, requiresAuth }),
};

// Alias for consistent import name across screens
export const apiClient = api;
