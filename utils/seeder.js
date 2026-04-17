require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Bus = require('../models/Bus');
const Route = require('../models/Route');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbus');
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([User.deleteMany(), Bus.deleteMany(), Route.deleteMany()]);
  console.log('Cleared existing data');

  // Create admin
  const admin = await User.create({
    name: 'Admin User', email: 'admin@busbee.com', password: 'admin123',
    role: 'admin', phone: '9876543210',
  });

  // Create routes
  const route1 = await Route.create({
    name: 'Route A - North Campus',
    startPoint: { name: 'City Center', location: { type: 'Point', coordinates: [77.5946, 12.9716] } },
    endPoint: { name: 'School Campus', location: { type: 'Point', coordinates: [77.6101, 12.9850] } },
    stops: [
      { name: 'MG Road', location: { type: 'Point', coordinates: [77.5946, 12.9716] }, estimatedTime: '07:00 AM', order: 1 },
      { name: 'Indiranagar', location: { type: 'Point', coordinates: [77.6401, 12.9784] }, estimatedTime: '07:15 AM', order: 2 },
      { name: 'Domlur', location: { type: 'Point', coordinates: [77.6280, 12.9607] }, estimatedTime: '07:25 AM', order: 3 },
      { name: 'School Campus', location: { type: 'Point', coordinates: [77.6101, 12.9850] }, estimatedTime: '07:40 AM', order: 4 },
    ],
    totalDistance: 12, estimatedDuration: 40,
    morningDeparture: '07:00 AM', eveningDeparture: '03:30 PM',
    color: '#3B82F6',
  });

  const route2 = await Route.create({
    name: 'Route B - South Campus',
    startPoint: { name: 'Koramangala', location: { type: 'Point', coordinates: [77.6245, 12.9352] } },
    endPoint: { name: 'School Campus', location: { type: 'Point', coordinates: [77.6101, 12.9850] } },
    stops: [
      { name: 'Koramangala', location: { type: 'Point', coordinates: [77.6245, 12.9352] }, estimatedTime: '07:05 AM', order: 1 },
      { name: 'HSR Layout', location: { type: 'Point', coordinates: [77.6477, 12.9116] }, estimatedTime: '07:20 AM', order: 2 },
      { name: 'BTM Layout', location: { type: 'Point', coordinates: [77.6152, 12.9165] }, estimatedTime: '07:30 AM', order: 3 },
      { name: 'School Campus', location: { type: 'Point', coordinates: [77.6101, 12.9850] }, estimatedTime: '07:50 AM', order: 4 },
    ],
    totalDistance: 15, estimatedDuration: 45,
    morningDeparture: '07:05 AM', eveningDeparture: '03:35 PM',
    color: '#10B981',
  });

  const route3 = await Route.create({
    name: 'Route C - Bhubaneswar to GIFT Campus',
    startPoint: { name: 'Bhubaneswar', location: { type: 'Point', coordinates: [85.8245, 20.2961] } },
    endPoint: { name: 'GIFT Campus', location: { type: 'Point', coordinates: [85.6740, 20.2234] } },
    stops: [
      { name: 'Bhubaneswar', location: { type: 'Point', coordinates: [85.8245, 20.2961] }, estimatedTime: '07:00 AM', order: 1 },
      { name: 'Khandagiri', location: { type: 'Point', coordinates: [85.7891, 20.2598] }, estimatedTime: '07:20 AM', order: 2 },
      { name: 'Tamando', location: { type: 'Point', coordinates: [85.7486, 20.2369] }, estimatedTime: '07:35 AM', order: 3 },
      { name: 'GIFT Campus', location: { type: 'Point', coordinates: [85.6740, 20.2234] }, estimatedTime: '08:30 AM', order: 4 },
    ],
    totalDistance: 24, estimatedDuration: 90,
    morningDeparture: '07:00 AM', eveningDeparture: '03:40 PM',
    color: '#F59E0B',
  });

  // Create drivers
  const driver1 = await User.create({
    name: 'Rajesh Kumar', email: 'driver1@busbee.com', password: 'driver123',
    role: 'driver', phone: '9876543211', licenseNumber: 'KA01-20180001',
  });
  const driver2 = await User.create({
    name: 'Suresh Patel', email: 'driver2@busbee.com', password: 'driver123',
    role: 'driver', phone: '9876543212', licenseNumber: 'KA01-20190002',
  });
  const driver3 = await User.create({
    name: 'Bibhu Prasad', email: 'driver3@busbee.com', password: 'driver123',
    role: 'driver', phone: '9876543214', licenseNumber: 'OD02-20200003',
  });

  // Create buses
  const bus1 = await Bus.create({
    busNumber: 'BUS-001', registrationNumber: 'KA01-AB-1234',
    capacity: 40, model: 'Tata Starbus', year: 2020,
    driver: driver1._id, route: route1._id,
    status: 'Stopped', speedLimit: 60,
    currentLocation: { type: 'Point', coordinates: [77.5946, 12.9716] },
  });
  const bus2 = await Bus.create({
    busNumber: 'BUS-002', registrationNumber: 'KA01-AB-5678',
    capacity: 35, model: 'Ashok Leyland', year: 2021,
    driver: driver2._id, route: route2._id,
    status: 'Running', speedLimit: 60,
    currentLocation: { type: 'Point', coordinates: [77.6245, 12.9352] },
  });
  const bus3 = await Bus.create({
    busNumber: 'BUS-003', registrationNumber: 'KA01-CD-9012',
    capacity: 45, model: 'Eicher Skyline', year: 2022,
    driver: driver3._id, route: route3._id,
    status: 'Delayed', speedLimit: 60,
    currentLocation: { type: 'Point', coordinates: [85.8245, 20.2961] },
  });

  // Assign buses to drivers
  await User.findByIdAndUpdate(driver1._id, { assignedBus: bus1._id });
  await User.findByIdAndUpdate(driver2._id, { assignedBus: bus2._id });
  await User.findByIdAndUpdate(driver3._id, { assignedBus: bus3._id });

  // Create parent
  await User.create({
    name: 'Parent User', email: 'parent@busbee.com', password: 'parent123',
    role: 'parent', phone: '9876543213',
    childName: 'Rahul', childClass: '8th Grade',
    subscribedBus: bus1._id,
  });

  console.log('✅ Seed data created successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('  Admin:  admin@busbee.com  / admin123');
  console.log('  Driver1: driver1@busbee.com / driver123');
  console.log('  Driver2: driver2@busbee.com / driver123');
  console.log('  Driver3: driver3@busbee.com / driver123');
  console.log('  Parent: parent@busbee.com  / parent123');

  await mongoose.disconnect();
};

seed().catch(console.error);
