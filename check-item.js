const fs = require('fs');
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://mcshivanesh777:Shivanesh%401495@shiva1.osdbukz.mongodb.net/smart-cafe?retryWrites=true&w=majority').then(async () => {
  const item = await mongoose.connection.db.collection('menuitems').findOne({itemName: /Chicken Fried Rice/i});
  fs.writeFileSync('result.json', JSON.stringify(item, null, 2));
  mongoose.disconnect();
});
