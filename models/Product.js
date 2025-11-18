const mongoose = require('mongoose');

// Review sub-schema (embedded in Product)
const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Review must belong to a user']
  },
  userName: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [500, 'Review comment cannot exceed 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Main Product schema
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    minlength: [3, 'Product name must be at least 3 characters'],
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  images: [{
    url: {
      type: String,
      required: [true, 'Image URL is required']
    },
    public_id: {
      type: String // For Cloudinary image management
    }
  }],
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Product category is required']
  },
  reviews: [reviewSchema], // Embedded reviews
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
    set: (val) => Math.round(val * 10) / 10 // Round to 1 decimal place
  },
  numReviews: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for search, filtering, and sorting
productSchema.index({ name: 'text', description: 'text' }); // Text search
productSchema.index({ category: 1, price: 1 }); // Filter by category and price
productSchema.index({ averageRating: -1 }); // Sort by rating
productSchema.index({ price: 1 }); // Sort by price
productSchema.index({ createdAt: -1 }); // Sort by newest
productSchema.index({ stock: 1 }); // Filter by availability

// Virtual: Check if product is in stock
productSchema.virtual('inStock').get(function() {
  return this.stock > 0;
});

// Instance method: Calculate and update average rating
productSchema.methods.calculateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.averageRating = 0;
    this.numReviews = 0;
  } else {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.averageRating = totalRating / this.reviews.length;
    this.numReviews = this.reviews.length;
  }
};

// Static method: Get products with filters, search, pagination
productSchema.statics.getProducts = async function(filters = {}) {
  const {
    search = '',
    category,
    minPrice,
    maxPrice,
    minRating,
    sort = '-createdAt',
    page = 1,
    limit = 12
  } = filters;

  // Build query
  const query = {};

  // Text search
  if (search) {
    query.$text = { $search: search };
  }

  // Category filter
  if (category) {
    query.category = category;
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined) query.price.$gte = Number(minPrice);
    if (maxPrice !== undefined) query.price.$lte = Number(maxPrice);
  }

  // Rating filter
  if (minRating) {
    query.averageRating = { $gte: Number(minRating) };
  }

  // Execute query with pagination
  const skip = (page - 1) * limit;
  
  const products = await this.find(query)
    .populate('category', 'name slug')
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  const total = await this.countDocuments(query);

  return {
    products,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      limit: Number(limit)
    }
  };
};

module.exports = mongoose.model('Product', productSchema);