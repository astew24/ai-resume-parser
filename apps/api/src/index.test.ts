import request from 'supertest';
import app from './index';

describe('API Endpoints', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/parse-resume', () => {
    it('should parse resume content', async () => {
      const resumeContent = `
        John Doe
        john.doe@email.com
        (555) 123-4567
        
        Skills:
        JavaScript, React, Node.js, TypeScript
        
        Experience:
        Software Engineer at Tech Corp (2020-2023)
        - Developed web applications using React and Node.js
        
        Education:
        Bachelor of Science in Computer Science
        University of Technology, 2020
      `;

      const response = await request(app)
        .post('/api/parse-resume')
        .send({
          content: resumeContent,
          format: 'txt'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
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
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should return error for invalid format', async () => {
      const response = await request(app)
        .post('/api/parse-resume')
        .send({
          content: 'Some content',
          format: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });
});