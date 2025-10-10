const express = require("express");
const router = express.Router();

const trafficSensorsRouter = require("./trafficSensors");
const airQualitySensorsRouter = require("./airQualitySensors");
const weatherSensorsRouter = require("./weatherSensors");

router.use("/traffic", trafficSensorsRouter);
router.use("/air-quality", airQualitySensorsRouter);
router.use("/weather", weatherSensorsRouter);

module.exports = router;