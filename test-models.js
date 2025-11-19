require('dotenv').config();
const connectDB = require('./config/db');
const User = require('./models/User');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Cart = require('./models/Cart');
const Order = require('./models/Order');

const testModels = async () => {
  try {
    await connectDB();
    console.log('✅ All models loaded successfully!');
    console.log('📦 Models:', {
      User: !!User,
      Category: !!Category,
      Product: !!Product,
      Cart: !!Cart,
      Order: !!Order
    });
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

testModels();