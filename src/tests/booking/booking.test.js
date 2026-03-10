const request = require('supertest');
const app = require('../../app');
const { User, MenuItem, Slot, Booking } = require('../../models');

const formatSlotTime = (date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')} ${period}`;
};

const getFutureSlotTime = () => {
  const now = new Date();
  const future = new Date(now.getTime() + 60 * 60000);

  if (
    future.getFullYear() !== now.getFullYear() ||
    future.getMonth() !== now.getMonth() ||
    future.getDate() !== now.getDate()
  ) {
    future.setHours(23, 59, 0, 0);
  }

  if (future <= now) {
    future.setMinutes(now.getMinutes() + 1, now.getSeconds(), 0);
  }

  return formatSlotTime(future);
};

describe('Booking API', () => {
  let userToken;
  let staffToken;
  let userId;
  let slotId;
  let menuItemId;
  
  beforeEach(async () => {
    // Create user
    const user = await User.create({
      fullName: 'Test Student',
      email: 'student@example.com',
      password: 'student123',
      role: 'user',
    });
    userId = user._id;
    
    // Create staff
    await User.create({
      fullName: 'Test Staff',
      email: 'staff@example.com',
      password: 'staff123',
      role: 'canteen_staff',
    });
    
    // Create menu item
    const menuItem = await MenuItem.create({
      itemName: 'Test Item',
      price: 100,
      isAvailable: true,
    });
    menuItemId = menuItem._id;
    
    // Create slot
    const slotDate = new Date();
    slotDate.setHours(0, 0, 0, 0);
    const slotTime = getFutureSlotTime();

    const slot = await Slot.create({
      date: slotDate,
      time: slotTime,
      capacity: 50,
      status: 'Open',
    });
    slotId = slot._id;
    
    // Get tokens
    const userRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@example.com', password: 'student123' });
    userToken = userRes.body.data.token;
    
    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@example.com', password: 'staff123' });
    staffToken = staffRes.body.data.token;
  });
  
  describe('POST /api/bookings', () => {
    it('should create a booking successfully', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 2 }],
        });
      
      expect(res.status).toBe(201);
      expect(res.body.data.tokenNumber).toBeDefined();
      expect(res.body.data.totalAmount).toBe(200);
    });
    
    it('should fail for unavailable slot', async () => {
      await Slot.findByIdAndUpdate(slotId, { status: 'Cancelled' });
      
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString() }],
        });
      
      expect(res.status).toBe(400);
    });
  });
  
  describe('POST /api/bookings/:id/cancel', () => {
    let bookingId;
    
    beforeEach(async () => {
      const booking = await Booking.create({
        user: userId,
        slot: slotId,
        items: [{ menuItem: menuItemId, quantity: 1, price: 100 }],
        totalAmount: 100,
        status: 'confirmed',
      });
      bookingId = booking._id;
    });
    
    it('should cancel booking', async () => {
      const res = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Changed my mind' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cancelled');
    });
  });
  
  describe('POST /api/bookings/:id/complete', () => {
    let bookingId;
    
    beforeEach(async () => {
      const booking = await Booking.create({
        user: userId,
        slot: slotId,
        items: [{ menuItem: menuItemId, quantity: 1, price: 100 }],
        totalAmount: 100,
        status: 'confirmed',
      });
      bookingId = booking._id;
    });
    
    it('should complete booking (staff)', async () => {
      const res = await request(app)
        .post(`/api/bookings/${bookingId}/complete`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
    });
  });
});
