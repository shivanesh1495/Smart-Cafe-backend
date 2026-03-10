const fs = require('fs');
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://mcshivanesh777:Shivanesh%401495@shiva1.osdbukz.mongodb.net/smart-cafe?retryWrites=true&w=majority').then(async () => {
  const item = await mongoose.connection.db.collection('menuitems').findOneAndUpdate(
    {itemName: /Appam with Chicken Stew/i},
    { $set: { isAvailable: true, availableQuantity: 100 } },
    { returnDocument: 'after' }
  );
  fs.writeFileSync('result.json', JSON.stringify(item || {}, null, 2));
  mongoose.disconnect();
});
