const express = require('express');
const router = express.Router();
const { startTrip, endTrip, updateLocation, getTrips, triggerSOS } = require('../controllers/tripController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getTrips);
router.post('/start', protect, authorize('driver'), startTrip);
router.put('/:id/end', protect, authorize('driver'), endTrip);
router.post('/:id/location', protect, authorize('driver'), updateLocation);
router.post('/:id/sos', protect, authorize('driver'), triggerSOS);

module.exports = router;
