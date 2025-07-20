import request from 'supertest';
import app from './index';

describe('AI Resume Parser API', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'AI Resume Parser API is running');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
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

    it('should return error for missing content', async () => {
      const response = await request(app)
        .post('/api/parse-resume')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
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
}); 