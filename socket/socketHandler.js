const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Bus = require('../models/Bus');
const Trip = require('../models/Trip');

// Track active connections
const activeDrivers = new Map(); // driverId -> socketId
const busRooms = new Map();      // busId -> Set of socketIds

const initializeSocket = (io) => {
  // Auth middleware for socket
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        socket.user = await User.findById(decoded.id).select('-password');
      } catch (err) {
        // Allow unauthenticated connections for public viewers
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} | User: ${socket.user?.name || 'Guest'}`);

    // ---- JOIN BUS ROOM (for parents/faculty to track a specific bus) ----
    socket.on('join_bus_room', async ({ busId }) => {
      socket.join(`bus_${busId}`);
      if (!busRooms.has(busId)) busRooms.set(busId, new Set());
      busRooms.get(busId).add(socket.id);

      // Send current bus state immediately
      try {
        const bus = await Bus.findById(busId)
          .select('busNumber status currentLocation currentSpeed lastLocationUpdate activeTrip')
          .populate('activeTrip', 'status startTime');
        if (bus) {
          socket.emit('bus_current_state', {
            busId,
            busNumber: bus.busNumber,
            status: bus.status,
            location: bus.currentLocation?.coordinates,
            speed: bus.currentSpeed,
            lastUpdate: bus.lastLocationUpdate,
            activeTrip: bus.activeTrip,
          });
        }
      } catch (err) {
        console.error('Error fetching bus state:', err);
      }
      console.log(`Socket ${socket.id} joined bus_${busId}`);
    });

    // ---- LEAVE BUS ROOM ----
    socket.on('leave_bus_room', ({ busId }) => {
      socket.leave(`bus_${busId}`);
      busRooms.get(busId)?.delete(socket.id);
    });

    // ---- JOIN ADMIN ROOM ----
    socket.on('join_admin_room', () => {
      if (socket.user?.role === 'admin') {
        socket.join('admin_room');
        console.log(`Admin ${socket.user.name} joined admin room`);
      }
    });

    // ---- DRIVER: Start sending location ----
    socket.on('driver_connected', async ({ busId }) => {
      if (!socket.user || socket.user.role !== 'driver') return;
      socket.busId = busId;
      activeDrivers.set(socket.user._id.toString(), socket.id);
      socket.join(`driver_${socket.user._id}`);
      socket.join(`bus_${busId}`);

      // Notify admin room
      io.to('admin_room').emit('driver_online', {
        driverId: socket.user._id,
        driverName: socket.user.name,
        busId,
        timestamp: new Date(),
      });
      console.log(`Driver ${socket.user.name} connected for bus ${busId}`);
    });

    // ---- DRIVER: Real-time location update ----
    socket.on('location_update', async (data) => {
      if (!socket.user || socket.user.role !== 'driver') return;
      const { busId, lat, lng, speed, heading, tripId, status } = data;

      // Decide bus status if driver doesn't send explicit status
      const computedStatus = status
        ? status
        : speed >= 10
          ? 'Running'
          : speed > 0
            ? 'Running'
            : 'Stopped';

      try {
        // Update bus location and status in DB
        const updatedBus = await Bus.findByIdAndUpdate(busId, {
          currentLocation: { type: 'Point', coordinates: [lng, lat] },
          currentSpeed: speed || 0,
          lastLocationUpdate: new Date(),
          status: computedStatus,
        }, { new: true });

        // Add to trip history if active
        if (tripId) {
          await Trip.findByIdAndUpdate(tripId, {
            $push: {
              locationHistory: {
                $each: [{ coordinates: [lng, lat], speed, heading, status: computedStatus, timestamp: new Date() }],
                $slice: -1000,
              },
            },
          });
        }

        const locationData = {
          busId,
          lat,
          lng,
          speed,
          heading,
          status: computedStatus,
          timestamp: new Date(),
          driverId: socket.user._id,
          busNumber: updatedBus?.busNumber,
        };

        // Broadcast to all in bus room (drivers + listeners)
        socket.to(`bus_${busId}`).emit('location_update', locationData);
        socket.emit('location_update', locationData); // echo back to driver if needed

        // Global admin + monitoring feed
        io.to('admin_room').emit('bus_location_update', locationData);
        io.emit('bus_status_update', {
          busId,
          status: computedStatus,
          speed: speed || 0,
          lastLocationUpdate: locationData.timestamp,
          currentLocation: { lat, lng },
          busNumber: updatedBus?.busNumber,
        });

        // Speed violation check
        const bus = await Bus.findById(busId).select('speedLimit busNumber');
        if (bus && speed > bus.speedLimit) {
          const alert = {
            busId,
            busNumber: bus.busNumber,
            speed,
            limit: bus.speedLimit,
            timestamp: new Date(),
          };
          io.to('admin_room').emit('speed_violation', alert);
          socket.emit('speed_warning', alert);
        }
      } catch (err) {
        console.error('Location update error:', err);
      }
    });

    // ---- DRIVER: SOS ----
    socket.on('sos_trigger', async (data) => {
      if (!socket.user) return;
      const { busId, message, coordinates } = data;
      const bus = await Bus.findByIdAndUpdate(
        busId,
        { 'emergencyAlert.isActive': true, 'emergencyAlert.message': message, 'emergencyAlert.triggeredAt': new Date() },
        { new: true }
      ).populate('driver', 'name phone');

      const alert = {
        type: 'SOS',
        busId,
        busNumber: bus?.busNumber,
        driver: socket.user.name,
        phone: socket.user.phone,
        message,
        coordinates,
        timestamp: new Date(),
      };

      io.emit('emergency_alert', alert); // Broadcast to everyone
      console.log(`SOS ALERT: Bus ${bus?.busNumber} - ${message}`);
    });

    // ---- ADMIN: Send notification ----
    socket.on('send_notification', (data) => {
      if (socket.user?.role !== 'admin') return;
      io.emit('new_notification', { ...data, sentBy: socket.user.name, timestamp: new Date() });
    });

    // ---- DISCONNECT ----
    socket.on('disconnect', async () => {
      if (socket.user?.role === 'driver') {
        activeDrivers.delete(socket.user._id.toString());
        if (socket.busId) {
          busRooms.get(socket.busId)?.delete(socket.id);
          io.to('admin_room').emit('driver_offline', {
            driverId: socket.user._id,
            busId: socket.busId,
            timestamp: new Date(),
          });
        }
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = { initializeSocket, activeDrivers };
