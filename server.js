require("dotenv").config();

// ...existing code...
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");


const app = express();
const PORT = 5000;

// Swagger setup (must be after app is defined)
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart City Management System API',
      version: '1.0.0',
      description: 'API documentation for Smart City Management System',
    },
    servers: [
      { url: 'http://localhost:5000/api' }
    ],
  },
  apis: ['./routes/*.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware
app.use(cors());
app.use(bodyParser.json());

// App-level debug logger to trace incoming requests
app.use((req, res, next) => {
  console.log('[app] incoming', req.method, req.path);
  next();
});

// Temporary diagnostic endpoint to confirm the process receives POSTs
app.post('/sensors-local-test', (req, res) => {
  console.log('[local test] received POST /sensors-local-test');
  res.json({ ok: true, path: '/sensors-local-test' });
});

// Import routes
const authRoutes = require("./routes/auth");
console.log("Loaded authRoutes");
const complaintRoutes = require("./routes/complaints");
console.log("Loaded complaintRoutes");
const citizenRoutes = require("./routes/citizens");
console.log("Loaded citizenRoutes");
const vehicleRoutes = require("./routes/vehicles");
console.log("Loaded vehicleRoutes");
const utilityRoutes = require("./routes/utilities");
console.log("Loaded utilityRoutes");
const healthcareRoutes = require("./routes/healthcare");
console.log("Loaded healthcareRoutes");
const serviceRoutes = require("./routes/services");
console.log("Loaded serviceRoutes");
const providerRoutes = require("./routes/providers");
console.log("Loaded providerRoutes");
const doctorRoutes = require("./routes/doctors");
console.log("Loaded doctorRoutes");
const profileRoutes = require("./routes/profile");
console.log("Loaded profileRoutes");
const zonesRoutes = require("./routes/zones");
console.log("Loaded zonesRoutes");
const housesRoutes = require("./routes/houses");
console.log("Loaded housesRoutes");
const pipelinesRoutes = require("./routes/pipelines");
console.log("Loaded pipelinesRoutes");
const powernodesRoutes = require("./routes/powernodes");
console.log("Loaded powernodesRoutes");
const publicLightsRoutes = require("./routes/publicLights");
console.log("Loaded publicLightsRoutes");
const sensorsRoutes = require("./routes/sensors");
console.log("Loaded sensorsRoutes");
const smartBinsRoutes = require("./routes/smartBins");
console.log("Loaded smartBinsRoutes");
const transportRoutes = require("./routes/transport");
console.log("Loaded transportRoutes");
const transportSchedulesRoutes = require("./routes/transportSchedules");
console.log("Loaded transportSchedulesRoutes");
const infrastructureRoutes = require("./routes/infrastructure");
console.log("Loaded infrastructureRoutes");
const routesRoutes = require("./routes/routes");
console.log("Loaded routesRoutes");
const propertiesRoutes = require("./routes/properties");
console.log("Loaded propertiesRoutes");
const departmentsRoutes = require("./routes/departments");
console.log("Loaded departmentsRoutes");
const maintenanceRoutes = require("./routes/maintenance");
console.log("Loaded maintenanceRoutes");
const notificationsRoutes = require("./routes/notifications");
console.log("Loaded notificationsRoutes");
const adminRoutes = require("./routes/admin_routes");
console.log("Loaded adminRoutes");

// Register routes
app.use("/api/auth", authRoutes); console.log("Registered /api/auth");
app.use("/api/complaints", complaintRoutes); console.log("Registered /api/complaints");
app.use("/api/citizens", citizenRoutes); console.log("Registered /api/citizens");
app.use("/api/vehicles", vehicleRoutes); console.log("Registered /api/vehicles");
app.use("/api/utilities", utilityRoutes); console.log("Registered /api/utilities");
app.use("/api/healthcare", healthcareRoutes); console.log("Registered /api/healthcare");
app.use("/api/services", serviceRoutes); console.log("Registered /api/services");
app.use("/api/providers", providerRoutes); console.log("Registered /api/providers");
app.use("/api/doctors", doctorRoutes); console.log("Registered /api/doctors");
app.use("/api/profile", profileRoutes); console.log("Registered /api/profile");
app.use("/api/zones", zonesRoutes); console.log("Registered /api/zones");
app.use("/api/houses", housesRoutes); console.log("Registered /api/houses");
app.use("/api/pipelines", pipelinesRoutes); console.log("Registered /api/pipelines");
app.use("/api/powernodes", powernodesRoutes); console.log("Registered /api/powernodes");
app.use("/api/public-lights", publicLightsRoutes); console.log("Registered /api/public-lights");
app.use("/api/sensors", sensorsRoutes); console.log("Registered /api/sensors");
app.use("/api/smart-bins", smartBinsRoutes); console.log("Registered /api/smart-bins");
app.use("/api/transport", transportRoutes); console.log("Registered /api/transport");
app.use("/api/transport-schedules", transportSchedulesRoutes); console.log("Registered /api/transport-schedules");
app.use("/api/infrastructure", infrastructureRoutes); console.log("Registered /api/infrastructure");
app.use("/api/routes", routesRoutes); console.log("Registered /api/routes");
app.use("/api/properties", propertiesRoutes); console.log("Registered /api/properties");
app.use("/api/departments", departmentsRoutes); console.log("Registered /api/departments");
app.use("/api/maintenance", maintenanceRoutes); console.log("Registered /api/maintenance");
app.use("/api/announcements", notificationsRoutes); console.log("Registered /api/announcements");
app.use("/api/admin", adminRoutes); console.log("Registered /api/admin");
// Bookings endpoints are now provided via /api/services/bookings


// Default route
app.get("/", (req, res) => {
  res.send(" Smart City Backend is running...");
});

// Centralized error handler
const { errorHandler } = require("./middleware/error");
app.use(errorHandler);

// Test DB connection at startup
const db = require('./db');
db.query('SELECT 1')
  .then(() => console.log('DB connection test successful'))
  .catch(err => console.error('DB connection test failed:', err));

// Top-level error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// // Start the server
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', err => {
  console.error('Server failed to start:', err);
});
