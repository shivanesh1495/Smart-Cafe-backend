const mongoose = require('mongoose');
const { Slot, MenuItem, User, Booking } = require('./src/models');
const bookingService = require('./src/services/booking.service');
const slotService = require('./src/services/slot.service');
const fs = require('fs');

async function testBookingFlow() {
  await mongoose.connect('mongodb+srv://mcshivanesh777:Shivanesh%401495@shiva1.osdbukz.mongodb.net/smart-cafe?retryWrites=true&w=majority');
  let logs = [];
  const log = (...args) => logs.push(args.join(' '));

  log('Connected to DB');

  try {
    const user = await User.findOne({ segment: 'student' });
    if (!user) throw new Error('No student found');
    log('Found student:', user.name);

    const item = await MenuItem.findOne({ itemName: /Appam with Chicken Stew/i });
    if (!item) throw new Error('Appam not found');
    log('Found item:', item.itemName, 'Quantity:', item.availableQuantity);
    
    // Create a temporary open slot for today in the future
    const today = new Date();
    today.setHours(0,0,0,0);
    const slot = await Slot.create({
      time: '12:01 PM - 12:31 PM',
      date: today,
      capacity: 50,
      booked: 0,
      mealType: 'DINNER',
      status: 'Open',
      isDisabled: false
    });
    log('Created temp slot:', slot.time, 'on', slot.date, 'Booked:', slot.booked, '/', slot.capacity);

    const bookingData = {
      slotId: slot._id.toString(),
      items: [
        { menuItemId: item._id.toString(), quantity: 1 }
      ],
      notes: 'Test booking'
    };
    
    log('Attempting booking creation...');
    const booking = await bookingService.createBooking(user._id, bookingData);
    log('Booking successful! Token:', booking.tokenNumber);
    
    const updatedItem = await MenuItem.findById(item._id);
    const updatedSlot = await Slot.findById(slot._id);
    
    log('Updated item quantity:', updatedItem.availableQuantity, '(expected: ' + (item.availableQuantity - 1) + ')');
    log('Updated slot booked count:', updatedSlot.booked, '(expected: ' + (slot.booked + 1) + ')');
    
    await bookingService.cancelBooking(booking._id, user._id, 'Test cleanup');
    await Slot.findByIdAndDelete(slot._id);
    log('Test cleanup complete');
    
  } catch (err) {
    log('Test failed:', err.message);
    if (err.stack) log(err.stack);
  } finally {
    await mongoose.disconnect();
    fs.writeFileSync('output.txt', logs.join('\n'));
  }
}

testBookingFlow();
