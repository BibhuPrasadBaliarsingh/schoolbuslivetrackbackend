const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
  role: {
    type: String,
    enum: ['admin', 'driver', 'parent', 'faculty'],
    required: true,
    default: 'parent',
  },
  phone: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String,
    default: null,
  },
  // Driver-specific fields
  licenseNumber: String,
  licenseExpiry: Date,
  assignedBus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    default: null,
  },
  // Parent-specific fields
  childName: String,
  childClass: String,
  subscribedBus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    default: null,
  },
  fcmToken: String, // Firebase push notification token
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: Date,
  performanceScore: {
    type: Number,
    default: 100,
    min: 0,
    max: 100,
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
