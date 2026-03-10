const request = require('supertest');
const app = require('../../app');
const { User } = require('../../models');

describe('User API', () => {
  let adminToken;
  let userToken;
  
  beforeEach(async () => {
    // Create admin user
    const admin = await User.create({
      fullName: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin',
    });
    
    // Create regular user
    const user = await User.create({
      fullName: 'Regular User',
      email: 'user@example.com',
      password: 'user123',
      role: 'user',
    });
    
    // Get tokens
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'admin123' });
    adminToken = adminRes.body.data.token;
    
    const userRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'user123' });
    userToken = userRes.body.data.token;
  });
  
  describe('GET /api/users', () => {
    it('should return all users for admin', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(2);
    });
    
    it('should fail for non-admin user', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(res.status).toBe(403);
    });
  });
  
  describe('PATCH /api/users/:id/role', () => {
    it('should update user role', async () => {
      const user = await User.findOne({ email: 'user@example.com' });
      
      const res = await request(app)
        .patch(`/api/users/${user._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'manager' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('manager');
    });
  });
  
  describe('PATCH /api/users/:id/status', () => {
    it('should suspend user', async () => {
      const user = await User.findOne({ email: 'user@example.com' });
      
      const res = await request(app)
        .patch(`/api/users/${user._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('suspended');
    });
  });
});
