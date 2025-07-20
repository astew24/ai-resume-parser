import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Simple in-memory cache for parsed results (in production, use Redis)
const parsedResultsCache = new Map<string, any>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(limiter);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Custom logging format
const logFormat = NODE_ENV === 'production' 
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
  : ':method :url :status :response-time ms';

// Logging middleware
app.use(morgan(logFormat));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure multer for file uploads with enhanced validation
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, DOC, DOCX, and TXT files are allowed.`));
    }
  },
});

// Validation schemas with enhanced validation
const ResumeParseRequestSchema = z.object({
  content: z.string()
    .min(10, 'Resume content must be at least 10 characters')
    .max(50000, 'Resume content is too long (max 50,000 characters)'),
  format: z.enum(['pdf', 'doc', 'docx', 'txt']).optional(),
});

const ExperienceSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  position: z.string().min(1, 'Position is required'),
  duration: z.string().optional(),
  description: z.string().optional(),
});

const EducationSchema = z.object({
  institution: z.string().min(1, 'Institution name is required'),
  degree: z.string().min(1, 'Degree is required'),
  field: z.string().optional(),
  year: z.string().optional(),
});

const ResumeParseResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    skills: z.array(z.string()).optional(),
    experience: z.array(ExperienceSchema).optional(),
    education: z.array(EducationSchema).optional(),
  }).optional(),
  error: z.string().optional(),
});

// Custom error types
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParsingError';
  }
}

// Utility function to generate cache key
function generateCacheKey(content: string): string {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(content).digest('hex');
}

// Utility function to clean cache periodically
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of parsedResultsCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      parsedResultsCache.delete(key);
    }
  }
}

// Clean cache every 10 minutes
setInterval(cleanExpiredCache, 10 * 60 * 1000);

// Enhanced error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  };
  
  console.error(`[${timestamp}] Error:`, logData);
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: `File upload error: ${err.message}`,
      code: 'FILE_UPLOAD_ERROR',
    });
  }
  
  if (err.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'INVALID_FILE_TYPE',
    });
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'VALIDATION_ERROR',
    });
  }

  if (err instanceof ParsingError) {
    return res.status(422).json({
      success: false,
      error: err.message,
      code: 'PARSING_ERROR',
    });
  }
  
  // Default error response
  const statusCode = NODE_ENV === 'production' ? 500 : 500;
  const message = NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(statusCode).json({
    success: false,
    error: message,
    code: 'INTERNAL_ERROR',
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Health check endpoint with enhanced information
app.get('/health', (req: Request, res: Response) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    message: 'AI Resume Parser API is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    uptime: {
      seconds: Math.floor(uptime),
      minutes: Math.floor(uptime / 60),
      hours: Math.floor(uptime / 3600),
    },
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    },
    cache: {
      size: parsedResultsCache.size,
    },
  });
});

// Resume parsing endpoint with enhanced functionality
app.post('/api/parse-resume', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  try {
    let content = '';
    let format = 'txt';

    // Handle file upload
    if (req.file) {
      content = req.file.buffer.toString('utf-8');
      format = path.extname(req.file.originalname || '').toLowerCase().substring(1);
      
      // Validate file content
      if (!content.trim()) {
        throw new ValidationError('Uploaded file appears to be empty or unreadable');
      }
    } else if (req.body.content) {
      content = req.body.content;
      format = req.body.format || 'txt';
    } else {
      throw new ValidationError('No resume content or file provided');
    }

    // Check cache first
    const cacheKey = generateCacheKey(content);
    const cachedResult = parsedResultsCache.get(cacheKey);
    
    if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL) {
      console.log(`[${new Date().toISOString()}] Cache hit for content hash: ${cacheKey}`);
      return res.json(cachedResult.data);
    }

    // Validate input using Zod schema
    const validationResult = ResumeParseRequestSchema.safeParse({
      content,
      format,
    });

    if (!validationResult.success) {
      throw new ValidationError(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(', ')}`);
    }

    // Parse resume content
    const parsedData = await parseResumeContent(content);

    // Validate response using Zod schema
    const response = ResumeParseResponseSchema.parse({
      success: true,
      data: parsedData,
    });

    // Cache the result
    parsedResultsCache.set(cacheKey, {
      data: response,
      timestamp: Date.now(),
    });

    const processingTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Resume parsed successfully in ${processingTime}ms`);

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Enhanced resume parsing function with better extraction logic
async function parseResumeContent(content: string): Promise<z.infer<typeof ResumeParseResponseSchema>['data']> {
  try {
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Enhanced regex patterns for extraction
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const nameRegex = /^[A-Z][a-z]+ [A-Z][a-z]+$/;
    
    // Extract email addresses
    const emails = content.match(emailRegex) || [];
    const email = emails[0] || '';
    
    // Extract phone numbers
    const phones = content.match(phoneRegex) || [];
    const phone = phones[0] || '';
    
    // Extract potential name (first line that looks like a name)
    const name = lines.find(line => 
      nameRegex.test(line) && 
      !emailRegex.test(line) && 
      !phoneRegex.test(line) && 
      line.length > 2 && 
      line.length < 50
    ) || 'Unknown';
    
    // Enhanced skill extraction with more keywords
    const skillKeywords = [
      'javascript', 'python', 'react', 'node', 'sql', 'aws', 'docker', 'kubernetes', 
      'typescript', 'java', 'c++', 'html', 'css', 'angular', 'vue', 'php', 'ruby',
      'go', 'rust', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'git', 'jenkins',
      'terraform', 'ansible', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
      'machine learning', 'ai', 'data science', 'statistics', 'agile', 'scrum',
      'rest api', 'graphql', 'microservices', 'serverless', 'cloud computing',
      'devops', 'ci/cd', 'kubernetes', 'docker', 'jenkins', 'gitlab', 'github actions'
    ];
    
    const skills = lines
      .filter(line => skillKeywords.some(keyword => 
        line.toLowerCase().includes(keyword.toLowerCase())
      ))
      .map(line => line.toLowerCase().trim())
      .filter((skill, index, arr) => arr.indexOf(skill) === index); // Remove duplicates
    
    // Extract experience (basic pattern matching)
    const experience: z.infer<typeof ExperienceSchema>[] = [];
    const experienceKeywords = ['experience', 'work', 'employment', 'career'];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.toLowerCase() || '';
      if (experienceKeywords.some(keyword => line.includes(keyword))) {
        // Look for company/position patterns in subsequent lines
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const nextLine = lines[j];
          if (nextLine && nextLine.length > 3 && nextLine.length < 100) {
            experience.push({
              company: nextLine,
              position: 'Position',
              description: 'Experience details',
            });
            break;
          }
        }
      }
    }
    
    // Extract education (basic pattern matching)
    const education: z.infer<typeof EducationSchema>[] = [];
    const educationKeywords = ['education', 'degree', 'university', 'college', 'school'];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.toLowerCase() || '';
      if (educationKeywords.some(keyword => line.includes(keyword))) {
        // Look for institution/degree patterns in subsequent lines
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const nextLine = lines[j];
          if (nextLine && nextLine.length > 3 && nextLine.length < 100) {
            education.push({
              institution: nextLine,
              degree: 'Degree',
            });
            break;
          }
        }
      }
    }
    
    return {
      name,
      email,
      phone,
      skills: [...new Set(skills)], // Remove duplicates
      experience: experience.slice(0, 5), // Limit to 5 entries
      education: education.slice(0, 3), // Limit to 3 entries
    };
  } catch (error) {
    throw new ParsingError(`Failed to parse resume content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server with enhanced logging
app.listen(PORT, () => {
  console.log(`🚀 AI Resume Parser API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`💾 Cache TTL: ${CACHE_TTL / 1000 / 60} minutes`);
});

export default app;