const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Cart must belong to a user'],
    unique: true // One cart per user
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1
    },
    // Store price at time of adding to cart (for display purposes)
    price: {
      type: Number,
      required: true
    }
  }],
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for fast user cart lookup
cartSchema.index({ user: 1 });

// Pre-save middleware: Update timestamp
cartSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual: Calculate total cart value
cartSchema.virtual('totalPrice').get(function() {
  return this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
});

// Virtual: Get total number of items in cart
cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => {
    return total + item.quantity;
  }, 0);
});

// Instance method: Add item to cart
cartSchema.methods.addItem = async function(productId, quantity, price) {
  // Check if product already exists in cart
  const existingItem = this.items.find(
    item => item.product.toString() === productId.toString()
  );

  if (existingItem) {
    // Update quantity if product already in cart
    existingItem.quantity += quantity;
  } else {
    // Add new item to cart
    this.items.push({ product: productId, quantity, price });
  }

  await this.save();
  return this;
};

// Instance method: Update item quantity
cartSchema.methods.updateItemQuantity = async function(productId, quantity) {
  const item = this.items.find(
    item => item.product.toString() === productId.toString()
  );

  if (!item) {
    throw new Error('Product not found in cart');
  }

  if (quantity <= 0) {
    // Remove item if quantity is 0 or negative
    this.items = this.items.filter(
      item => item.product.toString() !== productId.toString()
    );
  } else {
    item.quantity = quantity;
  }

  await this.save();
  return this;
};

// Instance method: Remove item from cart
cartSchema.methods.removeItem = async function(productId) {
  this.items = this.items.filter(
    item => item.product.toString() !== productId.toString()
  );
  
  await this.save();
  return this;
};

// Instance method: Clear entire cart
cartSchema.methods.clearCart = async function() {
  this.items = [];
  await this.save();
  return this;
};

// Enable virtuals in JSON
cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Cart', cartSchema);