const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Order must belong to a user']
  },
  // Snapshot of products at time of purchase (embedded for historical accuracy)
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: [true, 'Product name is required']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    image: {
      type: String // Store main product image
    }
  }],
  shippingAddress: {
    street: { 
      type: String, 
      required: [true, 'Street address is required'] 
    },
    city: { 
      type: String, 
      required: [true, 'City is required'] 
    },
    state: { 
      type: String, 
      required: [true, 'State is required'] 
    },
    zipCode: { 
      type: String, 
      required: [true, 'Zip code is required'] 
    },
    country: { 
      type: String, 
      required: [true, 'Country is required'] 
    },
    phone: {
      type: String
    }
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  orderStatus: {
    type: String,
    enum: {
      values: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      message: 'Status must be one of: pending, confirmed, shipped, delivered, cancelled'
    },
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: {
      values: ['paid', 'unpaid'],
      message: 'Payment status must be either paid or unpaid'
    },
    default: 'unpaid'
  },
  paymentMethod: {
    type: String,
    default: 'dummy', // For dummy payment implementation
    enum: ['dummy', 'cod'] // Cash on delivery option
  },
  // Track order status changes
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for querying orders
orderSchema.index({ user: 1, createdAt: -1 }); // User's orders sorted by date
orderSchema.index({ orderStatus: 1 }); // Filter by status
orderSchema.index({ paymentStatus: 1 }); // Filter by payment
orderSchema.index({ createdAt: -1 }); // Sort by newest

// Pre-save middleware: Add status change to history
orderSchema.pre('save', function(next) {
  // If order status changed, add to history
  if (this.isModified('orderStatus')) {
    this.statusHistory.push({
      status: this.orderStatus,
      timestamp: new Date(),
      note: `Order status changed to ${this.orderStatus}`
    });
  }
  next();
});

// Virtual: Calculate number of items in order
orderSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Instance method: Update order status
orderSchema.methods.updateStatus = async function(newStatus, note = '') {
  this.orderStatus = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note: note || `Order status updated to ${newStatus}`
  });
  await this.save();
  return this;
};

// Instance method: Mark as paid
orderSchema.methods.markAsPaid = async function() {
  this.paymentStatus = 'paid';
  await this.save();
  return this;
};

// Instance method: Cancel order
orderSchema.methods.cancelOrder = async function(reason = '') {
  if (this.orderStatus === 'delivered') {
    throw new Error('Cannot cancel delivered orders');
  }
  
  this.orderStatus = 'cancelled';
  this.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    note: reason || 'Order cancelled'
  });
  
  await this.save();
  return this;
};

// Static method: Get user's order history with pagination
orderSchema.statics.getUserOrders = async function(userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  
  const orders = await this.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate('user', 'name email');

  const total = await this.countDocuments({ user: userId });

  return {
    orders,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      limit: Number(limit)
    }
  };
};

// Static method: Get all orders with filters (for admin)
orderSchema.statics.getAllOrders = async function(filters = {}) {
  const {
    status,
    paymentStatus,
    page = 1,
    limit = 20
  } = filters;

  const query = {};
  
  if (status) query.orderStatus = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;

  const skip = (page - 1) * limit;
  
  const orders = await this.find(query)
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await this.countDocuments(query);

  return {
    orders,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      limit: Number(limit)
    }
  };
};

// Enable virtuals in JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);