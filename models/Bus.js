const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
  busNumber: {
    type: String,
    required: [true, 'Bus number is required'],
    unique: true,
    uppercase: true,
    trim: true,
  },
  registrationNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
  },
  model: {
    type: String,
    trim: true,
  },
  year: Number,
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    default: null,
  },
  status: {
    type: String,
    enum: ['Running', 'Stopped', 'Delayed', 'Maintenance', 'Inactive'],
    default: 'Stopped',
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
  },
  currentSpeed: {
    type: Number,
    default: 0,
  },
  lastLocationUpdate: Date,
  activeTrip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    default: null,
  },
  insuranceExpiry: Date,
  fitnessExpiry: Date,
  lastMaintenance: Date,
  fuelLevel: {
    type: Number,
    min: 0,
    max: 100,
    default: 100,
  },
  speedLimit: {
    type: Number,
    default: 60,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  images: [String],
  emergencyAlert: {
    isActive: { type: Boolean, default: false },
    message: String,
    triggeredAt: Date,
  },
}, {
  timestamps: true,
});

busSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('Bus', busSchema);
