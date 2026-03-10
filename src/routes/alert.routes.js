const express = require('express');
const { notificationService } = require('../services');
const { ApiResponse } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const { authenticate, isAdmin } = require('../middlewares');

const router = express.Router();

router.get('/', authenticate, isAdmin, catchAsync(async (req, res) => {
  // Fetch system alerts (broadcasts of type 'alert' or 'system')
  const { logs } = await notificationService.getAllNotificationsLog({
    type: 'alert',
    limit: 5
  });

  ApiResponse.ok(res, 'System alerts fetched', logs);
}));

module.exports = router;
