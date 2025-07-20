/**
 * API utility functions for the AI Resume Parser
 */

// Types for API requests and responses
export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: Array<{
    company: string;
    position: string;
    duration?: string;
    description?: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field?: string;
    year?: string;
  }>;
}

export interface ParseResponse {
  success: boolean;
  data?: ParsedResume;
  error?: string;
  code?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

// Enhanced API utilities with timeout and retry logic
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

// Request timeout utility
const timeoutPromise = (ms: number) => new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Request timeout')), ms);
});

// Exponential backoff retry utility
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const result = await Promise.race([
        fn(),
        timeoutPromise(REQUEST_TIMEOUT)
      ]) as T;
      return result;
    } catch (error) {
      lastError = error as Error;
      
      if (i === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff: wait 2^i * 1000ms
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  public code?: string;
  public status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Helper function to create a timeout promise
 */
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), ms);
  });
}

/**
 * Helper function to make a fetch request with timeout and retry logic
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timeout - the server took too long to respond', 'TIMEOUT_ERROR');
    }
    throw error;
  }
}

/**
 * Helper function to retry a request
 */
async function retryRequest<T>(
  requestFn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Don't retry on certain errors
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Parse resume content by sending text to the API
 */
export async function parseResumeText(content: string): Promise<ParsedResume> {
  return retryWithBackoff(async () => {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          format: 'txt',
        }),
      });

      const result: ParseResponse = await response.json();

      if (!response.ok) {
        throw new ApiError(
          result.error || 'Failed to parse resume',
          result.code,
          response.status
        );
      }

      if (!result.success || !result.data) {
        throw new ApiError(
          result.error || 'Invalid response from server',
          result.code
        );
      }

      return result.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError('Network error: Unable to connect to the server', 'NETWORK_ERROR');
      }
      
      throw new ApiError(
        error instanceof Error ? error.message : 'An unexpected error occurred',
        'UNKNOWN_ERROR'
      );
    }
  });
}

/**
 * Parse resume file by uploading it to the API
 */
export async function parseResumeFile(file: File): Promise<ParsedResume> {
  return retryWithBackoff(async () => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetchWithTimeout(`${API_BASE_URL}/parse-file`, {
        method: 'POST',
        body: formData,
      });

      const result: ParseResponse = await response.json();

      if (!response.ok) {
        throw new ApiError(
          result.error || 'Failed to parse resume file',
          result.code,
          response.status
        );
      }

      if (!result.success || !result.data) {
        throw new ApiError(
          result.error || 'Invalid response from server',
          result.code
        );
      }

      return result.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError('Network error: Unable to connect to the server', 'NETWORK_ERROR');
      }
      
      throw new ApiError(
        error instanceof Error ? error.message : 'An unexpected error occurred',
        'UNKNOWN_ERROR'
      );
    }
  });
}

/**
 * Check API health status
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }, 5000); // Shorter timeout for health checks

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

/**
 * Validate file before upload
 */
export function validateFile(file: File): { isValid: boolean; error?: string } {
  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size too large. Please upload a file smaller than 5MB.',
    };
  }

  // Check file type
  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file type. Please upload a PDF, DOC, DOCX, or TXT file.',
    };
  }

  return { isValid: true };
}

/**
 * Validate resume content
 */
export function validateResumeContent(content: string): { isValid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return {
      isValid: false,
      error: 'Resume content is required.',
    };
  }

  if (content.trim().length < 10) {
    return {
      isValid: false,
      error: 'Resume content must be at least 10 characters long.',
    };
  }

  if (content.length > 50000) {
    return {
      isValid: false,
      error: 'Resume content is too long (maximum 50,000 characters).',
    };
  }

  return { isValid: true };
}

/**
 * Get API configuration info
 */
export function getApiConfig() {
  return {
    baseUrl: API_BASE_URL,
    timeout: REQUEST_TIMEOUT,
    maxRetries: MAX_RETRIES,
  };
} 