const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const { initializeSocket } = require('./socket/socketHandler');
const User = require('./models/User');
const Route = require('./models/Route');

// Route imports
const authRoutes = require('./routes/auth');
const busRoutes = require('./routes/buses');
const routeRoutes = require('./routes/routes');
const driverRoutes = require('./routes/drivers');
const tripRoutes = require('./routes/trips');
const locationRoutes = require('./routes/locations');
const complaintRoutes = require('./routes/complaints');
const expenseRoutes = require('./routes/expenses');
const maintenanceRoutes = require('./routes/maintenance');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const checkCorsOrigin = (origin, callback) => {
  // Allow all localhost, 127.0.0.1, LAN IPs, Netlify, and server-to-server (no origin)
  callback(null, true);
};

const io = new Server(server, {
  cors: {
    origin: checkCorsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: checkCorsOrigin,
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads and route map data
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// Make io accessible in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Initialize Socket.io handlers
initializeSocket(io);

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI );
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const PORT = process.env.PORT || 5000;

const ensureAdminUser = async () => {
  const adminName = process.env.ADMIN_NAME || 'Admin User';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@school.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  let admin = await User.findOne({ role: 'admin' });
  if (admin) {
    console.log(`✅ Admin account exists (${admin.email})`);
    return admin;
  }

  // If admin email already exists for non-admin user, upgrade role
  let existing = await User.findOne({ email: adminEmail });
  if (existing && existing.role !== 'admin') {
    existing.role = 'admin';
    existing.name = adminName;
    existing.password = adminPassword;
    existing = await existing.save();
    console.log(`✅ Existing user converted to admin: ${adminEmail}`);
    return existing;
  }

  if (!existing) {
    admin = await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      phone: process.env.ADMIN_PHONE || '0000000000',
    });

    console.log('✅ Default admin created:', adminEmail);
    console.log('   password:', adminPassword);
    return admin;
  }

  console.log(`✅ Admin user available: ${existing.email}`);
  return existing;
};

connectDB().then(async () => {
  try {
    await ensureAdminUser();
  } catch (err) {
    console.error('❌ Failed during startup initialization:', err);
  }

  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});

module.exports = { app, io };
