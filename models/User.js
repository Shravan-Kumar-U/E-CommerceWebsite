const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Address sub-schema (embedded)
const addressSchema = new mongoose.Schema({
  street: { 
    type: String, 
    required: [true, 'Street is required'] 
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
  isDefault: { 
    type: Boolean, 
    default: false 
  }
});

// Main User schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't return password in queries by default
  },
  googleAuthId: {
    type: String,
    unique: true,
    sparse: true // Allows null but unique when present
  },
  role: {
    type: String,
    enum: {
      values: ['user', 'admin'],
      message: 'Role must be either user or admin'
    },
    default: 'user'
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-()]+$/, 'Please provide a valid phone number']
  },
  addresses: [addressSchema], // Embedded addresses array
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product' // Reference to Product model
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for performance
//userSchema.index({ email: 1 }); // Unique index on email
//userSchema.index({ googleAuthId: 1 }, { sparse: true }); // Sparse index for Google OAuth

// Pre-save middleware: Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password')) return next();
  
  // Only hash if password exists (Google users may not have password)
  if (this.password) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Instance method: Compare password for login
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method: Get user object without sensitive data
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

module.exports = mongoose.model('User', userSchema);