import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
  },
});

// Validation schemas
const ResumeParseRequestSchema = z.object({
  content: z.string().min(1, 'Resume content is required'),
  format: z.enum(['pdf', 'doc', 'docx', 'txt']).optional(),
});

const ResumeParseResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    skills: z.array(z.string()).optional(),
    experience: z.array(z.object({
      company: z.string(),
      position: z.string(),
      duration: z.string().optional(),
      description: z.string().optional(),
    })).optional(),
    education: z.array(z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string().optional(),
      year: z.string().optional(),
    })).optional(),
  }).optional(),
  error: z.string().optional(),
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: 'File upload error: ' + err.message,
    });
  }
  
  if (err.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'AI Resume Parser API is running',
    timestamp: new Date().toISOString(),
  });
});

// Resume parsing endpoint
app.post('/api/parse-resume', upload.single('file'), async (req, res) => {
  try {
    let content = '';
    let format = 'txt';

    // Handle file upload
    if (req.file) {
      content = req.file.buffer.toString('utf-8');
      format = path.extname(req.file.originalname).toLowerCase().substring(1);
    } else if (req.body.content) {
      content = req.body.content;
      format = req.body.format || 'txt';
    } else {
      return res.status(400).json({
        success: false,
        error: 'No resume content or file provided',
      });
    }

    // Validate input
    const validationResult = ResumeParseRequestSchema.safeParse({
      content,
      format,
    });

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input: ' + validationResult.error.message,
      });
    }

    // TODO: Implement actual AI parsing logic here
    // For now, return a mock response
    const parsedData = await parseResumeContent(content);

    const response = ResumeParseResponseSchema.parse({
      success: true,
      data: parsedData,
    });

    res.json(response);
  } catch (error) {
    console.error('Parse resume error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to parse resume',
    });
  }
});

// Mock resume parsing function
async function parseResumeContent(content: string) {
  // This is a mock implementation
  // In a real application, you would integrate with an AI service like OpenAI, Azure, etc.
  
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Simple regex patterns for extraction
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  
  const email = content.match(emailRegex)?.[0];
  const phone = content.match(phoneRegex)?.[0];
  
  // Extract potential name (first line that doesn't contain email or phone)
  const name = lines.find(line => 
    !emailRegex.test(line) && 
    !phoneRegex.test(line) && 
    line.length > 2 && 
    line.length < 50
  );
  
  // Extract skills (lines containing common skill keywords)
  const skillKeywords = ['javascript', 'python', 'react', 'node', 'sql', 'aws', 'docker', 'kubernetes', 'typescript', 'java', 'c++', 'html', 'css'];
  const skills = lines
    .filter(line => skillKeywords.some(keyword => line.toLowerCase().includes(keyword)))
    .map(line => line.toLowerCase().trim());
  
  return {
    name: name || 'Unknown',
    email: email || '',
    phone: phone || '',
    skills: [...new Set(skills)], // Remove duplicates
    experience: [],
    education: [],
  };
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AI Resume Parser API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;