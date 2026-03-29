const mongoose = require('mongoose');

// COMPLAINT MODEL
const complaintSchema = new mongoose.Schema({
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  submitterName: String,
  submitterEmail: String,
  bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus' },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  category: {
    type: String,
    enum: ['driver_behavior', 'delay', 'route_issue', 'safety', 'vehicle_condition', 'other'],
    required: true,
  },
  description: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'closed'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  adminResponse: String,
  resolvedAt: Date,
  images: [String],
}, { timestamps: true });

// EXPENSE MODEL
const expenseSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  category: {
    type: String,
    enum: ['fuel', 'toll', 'repair', 'cleaning', 'other'],
    required: true,
  },
  amount: { type: Number, required: true, min: 0 },
  description: String,
  receiptImage: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  adminNote: String,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  date: { type: Date, default: Date.now },
}, { timestamps: true });

// MAINTENANCE MODEL
const maintenanceSchema = new mongoose.Schema({
  bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['routine', 'repair', 'emergency', 'inspection'],
    required: true,
  },
  description: { type: String, required: true },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
  },
  estimatedCost: Number,
  actualCost: Number,
  scheduledDate: Date,
  completedDate: Date,
  mechanicName: String,
  images: [String],
  adminNote: String,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// NOTIFICATION MODEL
const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['delay', 'emergency', 'general', 'route_change', 'maintenance', 'system'],
    default: 'general',
  },
  recipients: [{
    type: String,
    enum: ['all', 'parents', 'drivers', 'admin'],
  }],
  specificUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus' },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isRead: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: Date,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Complaint = mongoose.model('Complaint', complaintSchema);
const Expense = mongoose.model('Expense', expenseSchema);
const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Complaint, Expense, Maintenance, Notification };
