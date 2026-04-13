const Bus = require('../models/Bus');
const User = require('../models/User');
const Route = require('../models/Route');

// @desc    Get all buses (public)
// @route   GET /api/buses
exports.getBuses = async (req, res) => {
  try {
    const { status, search, route } = req.query;
    const filter = { isActive: true };

    if (status) filter.status = status;
    if (search) {
      const [drivers, routes] = await Promise.all([
        User.find({ role: 'driver', name: { $regex: search, $options: 'i' } }).select('_id'),
        Route.find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { 'startPoint.name': { $regex: search, $options: 'i' } },
            { 'endPoint.name': { $regex: search, $options: 'i' } },
          ],
        }).select('_id'),
      ]);

      filter.$or = [
        { busNumber: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { driver: { $in: drivers.map((driver) => driver._id) } },
        { route: { $in: routes.map((route) => route._id) } },
      ];
    }

    const buses = await Bus.find(filter)
      .populate('driver', 'name phone')
      .populate('route', 'name startPoint endPoint stops morningDeparture eveningDeparture')
      .populate('activeTrip', 'status startTime')
      .sort({ busNumber: 1 });

    res.json({ success: true, count: buses.length, buses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single bus
// @route   GET /api/buses/:id
exports.getBus = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id)
      .populate('driver', 'name phone email licenseNumber')
      .populate('route')
      .populate('activeTrip');

    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });
    res.json({ success: true, bus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create bus (admin)
// @route   POST /api/buses
exports.createBus = async (req, res) => {
  try {
    const bus = await Bus.create(req.body);
    res.status(201).json({ success: true, bus });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Bus number already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update bus (admin)
// @route   PUT /api/buses/:id
exports.updateBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    }).populate('driver', 'name phone').populate('route', 'name');

    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });
    res.json({ success: true, bus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete bus (admin)
// @route   DELETE /api/buses/:id
exports.deleteBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });
    res.json({ success: true, message: 'Bus deactivated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Assign driver to bus (admin)
// @route   PUT /api/buses/:id/assign-driver
exports.assignDriver = async (req, res) => {
  try {
    const { driverId } = req.body;
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });

    // Unassign previous driver
    if (bus.driver) {
      await User.findByIdAndUpdate(bus.driver, { assignedBus: null });
    }

    // Unassign driver from previous bus
    if (driverId) {
      const driver = await User.findById(driverId);
      if (!driver || driver.role !== 'driver') {
        return res.status(400).json({ success: false, message: 'Invalid driver' });
      }
      if (driver.assignedBus && driver.assignedBus.toString() !== req.params.id) {
        await Bus.findByIdAndUpdate(driver.assignedBus, { driver: null });
      }
      await User.findByIdAndUpdate(driverId, { assignedBus: req.params.id });
    }

    bus.driver = driverId || null;
    await bus.save();

    const updatedBus = await Bus.findById(bus._id)
      .populate('driver', 'name phone')
      .populate('route', 'name');

    res.json({ success: true, bus: updatedBus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get live bus location
// @route   GET /api/buses/:id/location
exports.getBusLocation = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id)
      .select('busNumber currentLocation currentSpeed status lastLocationUpdate activeTrip');
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });
    res.json({ success: true, bus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Trigger emergency alert on bus
// @route   POST /api/buses/:id/emergency
exports.triggerEmergency = async (req, res) => {
  try {
    const { message } = req.body;
    const bus = await Bus.findByIdAndUpdate(
      req.params.id,
      {
        emergencyAlert: {
          isActive: true,
          message: message || 'SOS Emergency!',
          triggeredAt: new Date(),
        },
      },
      { new: true }
    ).populate('driver', 'name phone');

    // Broadcast emergency via Socket.io
    req.io.emit('emergency_alert', {
      busId: bus._id,
      busNumber: bus.busNumber,
      message: bus.emergencyAlert.message,
      timestamp: bus.emergencyAlert.triggeredAt,
      driver: bus.driver,
    });

    res.json({ success: true, bus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear emergency alert
// @route   PUT /api/buses/:id/emergency/clear
exports.clearEmergency = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndUpdate(
      req.params.id,
      { 'emergencyAlert.isActive': false },
      { new: true }
    );
    req.io.emit('emergency_cleared', { busId: bus._id });
    res.json({ success: true, bus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
