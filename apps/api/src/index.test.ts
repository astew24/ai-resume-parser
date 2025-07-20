import request from 'supertest';
import app from './index';

describe('AI Resume Parser API', () => {
  describe('GET /health', () => {
    it('should return health status with detailed information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'AI Resume Parser API is running');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('cache');
      
      // Check uptime structure
      expect(response.body.uptime).toHaveProperty('seconds');
      expect(response.body.uptime).toHaveProperty('minutes');
      expect(response.body.uptime).toHaveProperty('hours');
      
      // Check memory structure
      expect(response.body.memory).toHaveProperty('rss');
      expect(response.body.memory).toHaveProperty('heapUsed');
      expect(response.body.memory).toHaveProperty('heapTotal');
      
      // Check cache structure
      expect(response.body.cache).toHaveProperty('size');
      expect(typeof response.body.cache.size).toBe('number');
    });
  });

  describe('POST /api/parse-resume', () => {
    it('should parse resume content from text', async () => {
      const resumeContent = `
        John Doe
        john.doe@example.com
        +1-555-123-4567
        
        Skills: JavaScript, React, Node.js, Python
        
        Experience:
        Software Engineer at Tech Corp (2020-2023)
        - Developed web applications using React and Node.js
        
        Education:
        Bachelor of Science in Computer Science
        University of Technology (2020)
      `;

      const response = await request(app)
        .post('/api/parse-resume')
        .send({
          content: resumeContent,
          format: 'txt'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data).toHaveProperty('phone');
      expect(response.body.data).toHaveProperty('skills');
    });

    it('should return cached result for identical content', async () => {
      const resumeContent = `
        Jane Smith
        jane.smith@example.com
        +1-555-987-6543
        
        Skills: Python, Machine Learning, Data Science
      `;

      // First request
      const response1 = await request(app)
        .post('/api/parse-resume')
        .send({
          content: resumeContent,
          format: 'txt'
        })
        .expect(200);

      // Second request with same content
      const response2 = await request(app)
        .post('/api/parse-resume')
        .send({
          content: resumeContent,
          format: 'txt'
        })
        .expect(200);

      // Both responses should be identical
      expect(response1.body).toEqual(response2.body);
    });

    it('should return error for empty content', async () => {
      const response = await request(app)
        .post('/api/parse-resume')
        .send({
          content: '',
          format: 'txt'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return error for content too short', async () => {
      const response = await request(app)
        .post('/api/parse-resume')
        .send({
          content: 'Short',
          format: 'txt'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return error for content too long', async () => {
      const longContent = 'A'.repeat(50001);
      
      const response = await request(app)
        .post('/api/parse-resume')
        .send({
          content: longContent,
          format: 'txt'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return error for missing content', async () => {
      const response = await request(app)
        .post('/api/parse-resume')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should handle file upload correctly', async () => {
      const response = await request(app)
        .post('/api/parse-resume')
        .attach('file', Buffer.from('John Doe\njohn@example.com\nSkills: JavaScript'), 'resume.txt')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    it('should return error for invalid file type', async () => {
      const response = await request(app)
        .post('/api/parse-resume')
        .attach('file', Buffer.from('test'), 'test.exe')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INVALID_FILE_TYPE');
    });

    it('should extract skills correctly', async () => {
      const resumeContent = `
        John Doe
        Skills: JavaScript, React, Node.js, Python, AWS, Docker
        Experience: Software Engineer
      `;

      const response = await request(app)
        .post('/api/parse-resume')
        .send({
          content: resumeContent,
          format: 'txt'
        })
        .expect(200);

      expect(response.body.data.skills).toContain('javascript');
      expect(response.body.data.skills).toContain('react');
      expect(response.body.data.skills).toContain('node');
      expect(response.body.data.skills).toContain('python');
    });

    it('should extract email correctly', async () => {
      const resumeContent = `
        John Doe
        john.doe@example.com
        Software Engineer
      `;

      const response = await request(app)
        .post('/api/parse-resume')
        .send({
          content: resumeContent,
          format: 'txt'
        })
        .expect(200);

      expect(response.body.data.email).toBe('john.doe@example.com');
    });

    it('should extract phone number correctly', async () => {
      const resumeContent = `
        John Doe
        +1-555-123-4567
        Software Engineer
      `;

      const response = await request(app)
        .post('/api/parse-resume')
        .send({
          content: resumeContent,
          format: 'txt'
        })
        .expect(200);

      expect(response.body.data.phone).toBe('+1-555-123-4567');
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics', async () => {
      const response = await request(app)
        .get('/cache/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('size');
      expect(response.body.data).toHaveProperty('maxAge');
      expect(response.body.data).toHaveProperty('memoryUsage');
      expect(response.body.data).toHaveProperty('cacheKeys');
      expect(Array.isArray(response.body.data.cacheKeys)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should limit requests per IP', async () => {
      // Make multiple requests to trigger rate limiting
      const requests = Array.from({ length: 101 }, () =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(res => res.status === 429);

      expect(rateLimitedResponse).toBeDefined();
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toHaveProperty('success', false);
        expect(rateLimitedResponse.body).toHaveProperty('error');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/parse-resume')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/parse-resume')
        .send({
          format: 'txt'
          // Missing content field
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });
}); 