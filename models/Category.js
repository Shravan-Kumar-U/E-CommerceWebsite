const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Category name must be at least 2 characters'],
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster slug lookups
//categorySchema.index({ slug: 1 });

// Pre-save middleware: Auto-generate slug from name
categorySchema.pre('save', function(next) {
  if (this.isModified('name')) {
    // Convert name to URL-friendly slug
    // Example: "Electronics & Gadgets" -> "electronics-gadgets"
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphen
      .replace(/^-+|-+$/g, '');      // Remove leading/trailing hyphens
  }
  next();
});

// Virtual field: Get product count for this category
categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  count: true
});

module.exports = mongoose.model('Category', categorySchema);