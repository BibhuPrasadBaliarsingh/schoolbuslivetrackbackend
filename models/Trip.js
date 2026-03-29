const mongoose = require('mongoose');

const locationSnapshotSchema = new mongoose.Schema({
  coordinates: { type: [Number], required: true }, // [lng, lat]
  speed: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
  heading: Number,
});

const tripSchema = new mongoose.Schema({
  bus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true,
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: true,
  },
  tripType: {
    type: String,
    enum: ['morning', 'evening', 'special'],
    default: 'morning',
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'cancelled'],
    default: 'pending',
  },
  startTime: Date,
  endTime: Date,
  startLocation: {
    coordinates: [Number],
    address: String,
  },
  endLocation: {
    coordinates: [Number],
    address: String,
  },
  locationHistory: [locationSnapshotSchema],
  completedStops: [{
    stopId: mongoose.Schema.Types.ObjectId,
    arrivedAt: Date,
    departedAt: Date,
  }],
  totalDistance: { type: Number, default: 0 },
  averageSpeed: { type: Number, default: 0 },
  maxSpeed: { type: Number, default: 0 },
  emergencyEvents: [{
    type: { type: String },
    message: String,
    coordinates: [Number],
    timestamp: Date,
    resolved: { type: Boolean, default: false },
  }],
  offRouteEvents: [{
    coordinates: [Number],
    timestamp: Date,
    distanceFromRoute: Number,
  }],
  speedViolations: [{
    speed: Number,
    limit: Number,
    coordinates: [Number],
    timestamp: Date,
  }],
  notes: String,
}, {
  timestamps: true,
});

module.exports = mongoose.model('Trip', tripSchema);
