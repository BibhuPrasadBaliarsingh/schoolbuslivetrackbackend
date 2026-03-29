const Bus = require('../models/Bus');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { Complaint, Expense, Maintenance, Notification } = require('../models/index');

// @desc    Get admin dashboard stats
// @route   GET /api/dashboard/admin
exports.getAdminDashboard = async (req, res) => {
  try {
    const [
      totalBuses,
      runningBuses,
      stoppedBuses,
      delayedBuses,
      totalDrivers,
      totalParents,
      activeTrips,
      pendingComplaints,
      pendingExpenses,
      pendingMaintenance,
      emergencyBuses,
    ] = await Promise.all([
      Bus.countDocuments({ isActive: true }),
      Bus.countDocuments({ status: 'Running', isActive: true }),
      Bus.countDocuments({ status: 'Stopped', isActive: true }),
      Bus.countDocuments({ status: 'Delayed', isActive: true }),
      User.countDocuments({ role: 'driver', isActive: true }),
      User.countDocuments({ role: { $in: ['parent', 'faculty'] }, isActive: true }),
      Trip.countDocuments({ status: 'active' }),
      Complaint.countDocuments({ status: 'pending' }),
      Expense.countDocuments({ status: 'pending' }),
      Maintenance.countDocuments({ status: 'pending' }),
      Bus.countDocuments({ 'emergencyAlert.isActive': true }),
    ]);

    // Monthly trip stats (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrips = await Trip.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: 'completed' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
          avgSpeed: { $avg: '$averageSpeed' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Recent activities
    const recentTrips = await Trip.find()
      .populate('bus', 'busNumber')
      .populate('driver', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentComplaints = await Complaint.find()
      .populate('bus', 'busNumber')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      stats: {
        buses: { total: totalBuses, running: runningBuses, stopped: stoppedBuses, delayed: delayedBuses },
        users: { drivers: totalDrivers, parents: totalParents },
        trips: { active: activeTrips },
        alerts: { complaints: pendingComplaints, expenses: pendingExpenses, maintenance: pendingMaintenance, emergency: emergencyBuses },
      },
      charts: { monthlyTrips },
      recent: { trips: recentTrips, complaints: recentComplaints },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get driver dashboard
// @route   GET /api/dashboard/driver
exports.getDriverDashboard = async (req, res) => {
  try {
    const driver = req.user;
    const bus = await Bus.findOne({ driver: driver._id, isActive: true })
      .populate('route')
      .populate('activeTrip');

    const [totalTrips, completedTrips, pendingExpenses] = await Promise.all([
      Trip.countDocuments({ driver: driver._id }),
      Trip.countDocuments({ driver: driver._id, status: 'completed' }),
      Expense.countDocuments({ driver: driver._id, status: 'pending' }),
    ]);

    // Today's trips
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTrips = await Trip.find({
      driver: driver._id,
      createdAt: { $gte: today },
    }).populate('bus', 'busNumber').populate('route', 'name');

    res.json({
      success: true,
      bus,
      stats: { totalTrips, completedTrips, pendingExpenses, performanceScore: driver.performanceScore },
      todayTrips,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
