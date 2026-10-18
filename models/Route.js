const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  estimatedTime: String, // e.g., "07:30 AM"
  order: { type: Number, required: true },
  radius: { type: Number, default: 100 }, // geofence radius in meters
  stopsHere: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  stopId: { type: String },
});

const routeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Route name is required'],
    trim: true,
  },
  routeCode: {
    type: String,
    trim: true,
  },
  startPoint: {
    name: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
  },
  endPoint: {
    name: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
  },
  stops: [stopSchema],
  totalDistance: Number, // in km
  estimatedDuration: Number, // in minutes
  morningDeparture: String, // e.g., "07:00 AM"
  eveningDeparture: String,
  isActive: {
    type: Boolean,
    default: true,
  },
  polyline: String, // encoded polyline for map rendering
  pathCoordinates: {
    type: [[Number]],
    default: [],
  },
  color: {
    type: String,
    default: '#3B82F6',
  },
  bus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    default: null,
  },
}, {
  timestamps: true,
});

routeSchema.index({ 'startPoint.location': '2dsphere' });
routeSchema.index({ 'stops.location': '2dsphere' });

module.exports = mongoose.model('Route', routeSchema);
