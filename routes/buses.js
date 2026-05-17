const express = require('express');
const router = express.Router();
const {
  getBuses, getBus, createBus, updateBus, deleteBus,
  assignDriver, getBusLocation, triggerEmergency, clearEmergency,
  setDriverOnline, setDriverOffline, updateDriverLocation,
} = require('../controllers/busController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, getBuses);
router.get('/:id', optionalAuth, getBus);
router.get('/:id/location', getBusLocation);
router.post('/', protect, authorize('admin'), createBus);
router.put('/:id', protect, authorize('admin'), updateBus);
router.delete('/:id', protect, authorize('admin'), deleteBus);
router.put('/:id/assign-driver', protect, authorize('admin'), assignDriver);
router.post('/:id/emergency', protect, authorize('driver', 'admin'), triggerEmergency);
router.put('/:id/emergency/clear', protect, authorize('admin'), clearEmergency);

// Driver online/offline status endpoints
router.post('/:id/driver-online', protect, authorize('driver'), setDriverOnline);
router.post('/:id/driver-offline', protect, authorize('driver'), setDriverOffline);
router.post('/:id/update-location', protect, authorize('driver'), updateDriverLocation);

module.exports = router;
