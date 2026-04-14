const Trip = require('../models/Trip');
const Bus = require('../models/Bus');
const User = require('../models/User');

// @desc    Start a trip (driver)
// @route   POST /api/trips/start
exports.startTrip = async (req, res) => {
  try {
    const { busId, routeId, tripType, startLocation } = req.body;
    const driver = req.user;

    // Verify driver is assigned to this bus
    const bus = await Bus.findById(busId);
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });
    if (bus.driver?.toString() !== driver._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this bus' });
    }
    if (bus.activeTrip) {
      return res.status(400).json({ success: false, message: 'Trip already active for this bus' });
    }
    if (!routeId && !bus.route) {
      return res.status(400).json({ success: false, message: 'No route assigned to this bus' });
    }

    // Determine trip start location
    let resolvedStartLocation = null;
    if (startLocation && Array.isArray(startLocation.coordinates) && startLocation.coordinates.length === 2) {
      resolvedStartLocation = {
        coordinates: startLocation.coordinates,
        address: startLocation.address || '',
      };
    }

    const route = await require('../models/Route').findById(routeId || bus.route).select('startPoint stops');
    if (!resolvedStartLocation && route) {
      if (route.startPoint?.location?.coordinates?.length === 2) {
        resolvedStartLocation = {
          coordinates: route.startPoint.location.coordinates,
          address: route.startPoint.name || '',
        };
      } else if (Array.isArray(route.stops) && route.stops.length > 0) {
        const firstStop = [...route.stops].sort((a, b) => (a.order || 0) - (b.order || 0))[0];
        if (firstStop?.location?.coordinates?.length === 2) {
          resolvedStartLocation = {
            coordinates: firstStop.location.coordinates,
            address: firstStop.name || '',
          };
        }
      }
    }

    const trip = await Trip.create({
      bus: busId,
      driver: driver._id,
      route: routeId || bus.route,
      tripType: tripType || 'morning',
      status: 'active',
      startTime: new Date(),
      startLocation: resolvedStartLocation,
    });

    // Update bus
    const busUpdate = {
      activeTrip: trip._id,
      status: 'Running',
    };
    if (resolvedStartLocation) {
      busUpdate.currentLocation = { type: 'Point', coordinates: resolvedStartLocation.coordinates };
      busUpdate.currentSpeed = 0;
      busUpdate.lastLocationUpdate = new Date();
    }

    await Bus.findByIdAndUpdate(busId, busUpdate);

    // Broadcast trip start
    req.io.to(`bus_${busId}`).emit('trip_started', {
      tripId: trip._id,
      busId,
      busNumber: bus.busNumber,
      driverName: driver.name,
      startTime: trip.startTime,
    });

    const populatedTrip = await Trip.findById(trip._id)
      .populate('bus', 'busNumber')
      .populate('driver', 'name phone')
      .populate('route');

    res.status(201).json({ success: true, trip: populatedTrip });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    End a trip (driver)
// @route   PUT /api/trips/:id/end
exports.endTrip = async (req, res) => {
  try {
    const { endLocation } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
    if (trip.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Calculate stats
    const endTime = new Date();
    const duration = (endTime - trip.startTime) / 1000 / 60; // in minutes

    let totalDistance = 0;
    let maxSpeed = 0;
    let speedSum = 0;

    if (trip.locationHistory.length > 1) {
      for (let i = 1; i < trip.locationHistory.length; i++) {
        const speed = trip.locationHistory[i].speed || 0;
        if (speed > maxSpeed) maxSpeed = speed;
        speedSum += speed;
      }
    }

    const avgSpeed = trip.locationHistory.length > 0 ? speedSum / trip.locationHistory.length : 0;

    trip.status = 'completed';
    trip.endTime = endTime;
    trip.endLocation = endLocation;
    trip.totalDistance = totalDistance;
    trip.averageSpeed = avgSpeed;
    trip.maxSpeed = maxSpeed;
    await trip.save();

    // Update bus
    await Bus.findByIdAndUpdate(trip.bus, {
      activeTrip: null,
      status: 'Stopped',
    });

    // Broadcast trip end
    req.io.to(`bus_${trip.bus}`).emit('trip_ended', {
      tripId: trip._id,
      busId: trip.bus,
    });

    res.json({ success: true, trip });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update location during trip (driver)
// @route   POST /api/trips/:id/location
exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng, speed, heading } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip || trip.status !== 'active') {
      return res.status(400).json({ success: false, message: 'No active trip found' });
    }

    const locationSnapshot = {
      coordinates: [lng, lat],
      speed: speed || 0,
      heading,
      timestamp: new Date(),
    };

    // Add to history (keep last 1000 points)
    trip.locationHistory.push(locationSnapshot);
    if (trip.locationHistory.length > 1000) {
      trip.locationHistory = trip.locationHistory.slice(-1000);
    }
    await trip.save();

    // Update bus current location
    const bus = await Bus.findByIdAndUpdate(trip.bus, {
      currentLocation: { type: 'Point', coordinates: [lng, lat] },
      currentSpeed: speed || 0,
      lastLocationUpdate: new Date(),
    }, { new: true });

    // Broadcast location update
    const locationUpdate = {
      busId: trip.bus,
      busNumber: bus.busNumber,
      lat, lng, speed,
      heading,
      timestamp: new Date(),
      tripId: trip._id,
    };

    req.io.to(`bus_${trip.bus}`).emit('location_update', locationUpdate);
    req.io.emit('bus_location_update', locationUpdate); // Global update for admin

    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get trip history
// @route   GET /api/trips
exports.getTrips = async (req, res) => {
  try {
    const { busId, driverId, status, limit = 20, page = 1 } = req.query;
    const filter = {};
    if (busId) filter.bus = busId;
    if (driverId) filter.driver = driverId;
    if (status) filter.status = status;

    // Drivers can only see their own trips
    if (req.user.role === 'driver') filter.driver = req.user._id;

    const trips = await Trip.find(filter)
      .populate('bus', 'busNumber')
      .populate('driver', 'name')
      .populate('route', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Trip.countDocuments(filter);

    res.json({ success: true, trips, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Trigger SOS from driver
// @route   POST /api/trips/:id/sos
exports.triggerSOS = async (req, res) => {
  try {
    const { message, coordinates } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });

    const event = {
      type: 'sos',
      message: message || 'Driver triggered SOS',
      coordinates,
      timestamp: new Date(),
    };

    trip.emergencyEvents.push(event);
    await trip.save();

    const bus = await Bus.findByIdAndUpdate(trip.bus, {
      emergencyAlert: { isActive: true, message: event.message, triggeredAt: new Date() },
    }, { new: true }).populate('driver', 'name phone');

    // Broadcast SOS
    req.io.emit('sos_alert', {
      tripId: trip._id,
      busId: trip.bus,
      busNumber: bus.busNumber,
      driver: bus.driver,
      message: event.message,
      coordinates,
      timestamp: event.timestamp,
    });

    res.json({ success: true, message: 'SOS sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
