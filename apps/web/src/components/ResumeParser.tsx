'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, FileText, User, Mail, Phone, Briefcase, GraduationCap, Loader2, AlertCircle, CheckCircle, Wifi, WifiOff, RefreshCw, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseResumeText, parseResumeFile, validateFile, validateResumeContent, checkApiHealth, type ParsedResume, ApiError } from '@/lib/api';

// Validation schema for the form
const resumeFormSchema = z.object({
  content: z.string().min(10, 'Resume content must be at least 10 characters').max(50000, 'Resume content is too long (max 50,000 characters)'),
});

type ResumeFormData = z.infer<typeof resumeFormSchema>;

export default function ResumeParser() {
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedResume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [retryCount, setRetryCount] = useState(0);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
    watch,
  } = useForm<ResumeFormData>({
    resolver: zodResolver(resumeFormSchema),
  });

  const watchedContent = watch('content');

  // Check API health on component mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const isHealthy = await checkApiHealth();
        setApiStatus(isHealthy ? 'online' : 'offline');
        if (isHealthy) {
          setRetryCount(0); // Reset retry count on successful connection
        }
      } catch (error) {
        setApiStatus('offline');
      }
    };

    checkHealth();
    
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle file upload with enhanced validation
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file using utility function
    const validation = validateFile(file);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setUploadedFile(file);
    setError(null);

    // Read file content for text files
    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setValue('content', content);
      };
      reader.onerror = () => {
        setError('Failed to read file content');
      };
      reader.readAsText(file);
    } else {
      // For other file types, clear the text content
      setValue('content', '');
    }
  }, [setValue]);

  // Parse resume function with enhanced error handling and retry logic
  const parseResume = async (data: ResumeFormData) => {
    setIsLoading(true);
    setError(null);
    setParsedData(null);
    setProcessingTime(null);
    
    const startTime = Date.now();
    
    try {
      let result: ParsedResume;
      
      if (uploadedFile) {
        result = await parseResumeFile(uploadedFile);
      } else {
        result = await parseResumeText(data.content);
      }
      
      const endTime = Date.now();
      setProcessingTime(endTime - startTime);
      setParsedData(result);
      setApiStatus('online');
      setRetryCount(0);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to parse resume');
      setApiStatus('offline');
      setRetryCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  // Retry function
  const handleRetry = useCallback(() => {
    if (retryCount < 3) {
      parseResume({ content: watchedContent || '' });
    } else {
      setError('Maximum retry attempts reached. Please check your connection and try again.');
    }
  }, [retryCount, watchedContent]);

  // Reset form
  const handleReset = () => {
    reset();
    setParsedData(null);
    setError(null);
    setUploadedFile(null);
    setRetryCount(0);
    setProcessingTime(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      const validation = validateFile(file);
      if (validation.isValid) {
        setUploadedFile(file);
        setError(null);
        
        if (file.type === 'text/plain') {
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            setValue('content', content);
          };
          reader.readAsText(file);
        } else {
          setValue('content', '');
        }
      } else {
        setError(validation.error || 'Invalid file');
      }
    }
  }, [setValue]);

  // Export parsed data as JSON
  const handleExport = useCallback(() => {
    if (!parsedData) return;
    
    const dataStr = JSON.stringify(parsedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'parsed-resume.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [parsedData]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          AI Resume Parser
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Upload your resume or paste the content to extract key information using AI
        </p>
        
        <div className="space-y-6">
          {/* API Status Indicator */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              {apiStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              {apiStatus === 'online' && <Wifi className="h-4 w-4 text-green-500" />}
              {apiStatus === 'offline' && <WifiOff className="h-4 w-4 text-red-500" />}
              <span className="text-sm font-medium">
                API Status: {apiStatus === 'checking' ? 'Checking...' : apiStatus === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
            {apiStatus === 'offline' && (
              <button
                onClick={() => window.location.reload()}
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry</span>
              </button>
            )}
          </div>

          {/* Processing Time Display */}
          {processingTime && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Processed in {processingTime}ms</span>
            </div>
          )}

          {/* Progress Indicator */}
          {isLoading && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Upload Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
      >
        <form onSubmit={handleSubmit(parseResume)} className="space-y-6">
          {/* File Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Upload Resume File
            </label>
            <div className="flex items-center justify-center w-full">
              <label 
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-600 hover:bg-gray-100 dark:border-gray-500 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    PDF, DOC, DOCX, or TXT (MAX. 5MB)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                  disabled={isLoading}
                />
              </label>
            </div>
            {uploadedFile && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4" />
                {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Or Paste Resume Content
            </label>
            <textarea
              {...register('content')}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-vertical"
              placeholder="Paste your resume content here..."
              disabled={isLoading}
            />
            {errors.content && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.content.message}</p>
            )}
            {watchedContent && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {watchedContent.length} characters
              </p>
            )}
          </div>

          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-red-700 dark:text-red-400 flex-1">{error}</span>
                {retryCount < 3 && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isLoading || apiStatus === 'offline'}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Parse Resume
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Reset
            </button>
          </div>
        </form>
      </motion.div>

      {/* Results Section */}
      <AnimatePresence>
        {parsedData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Parsed Results</h2>
              <div className="flex items-center gap-4">
                {processingTime && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Processed in {processingTime}ms
                  </span>
                )}
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export JSON
                </button>
              </div>
            </div>
            
            {/* Personal Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <User className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                  <p className="font-medium text-gray-900 dark:text-white">{parsedData.name}</p>
                </div>
              </div>
              
              {parsedData.email && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Mail className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                    <p className="font-medium text-gray-900 dark:text-white">{parsedData.email}</p>
                  </div>
                </div>
              )}
              
              {parsedData.phone && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Phone className="w-5 h-5 text-purple-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                    <p className="font-medium text-gray-900 dark:text-white">{parsedData.phone}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Skills */}
            {parsedData.skills && parsedData.skills.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {parsedData.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {parsedData.experience && parsedData.experience.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Experience
                </h3>
                <div className="space-y-4">
                  {parsedData.experience.map((exp, index) => (
                    <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <h4 className="font-medium text-gray-900 dark:text-white">{exp.position}</h4>
                      <p className="text-gray-600 dark:text-gray-400">{exp.company}</p>
                      {exp.duration && (
                        <p className="text-sm text-gray-500 dark:text-gray-500">{exp.duration}</p>
                      )}
                      {exp.description && (
                        <p className="mt-2 text-gray-700 dark:text-gray-300">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {parsedData.education && parsedData.education.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Education
                </h3>
                <div className="space-y-4">
                  {parsedData.education.map((edu, index) => (
                    <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <h4 className="font-medium text-gray-900 dark:text-white">{edu.degree}</h4>
                      <p className="text-gray-600 dark:text-gray-400">{edu.institution}</p>
                      {edu.field && (
                        <p className="text-gray-600 dark:text-gray-400">{edu.field}</p>
                      )}
                      {edu.year && (
                        <p className="text-sm text-gray-500 dark:text-gray-500">{edu.year}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}