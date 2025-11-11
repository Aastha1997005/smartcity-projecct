require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 5000;

// Swagger setup
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart City Management System API',
      version: '1.0.0',
      description: 'Comprehensive API for managing smart city infrastructure, services, and citizens',
    },
    servers: [
      { url: `http://localhost:${PORT}/api`, description: 'Development server' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./routes/*.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Import all routes
const authRoutes = require("./routes/auth");
const complaintRoutes = require("./routes/complaints");
const citizenRoutes = require("./routes/citizens");
const vehicleRoutes = require("./routes/vehicles");
const utilityRoutes = require("./routes/utilities");
const healthcareRoutes = require("./routes/healthcare");
const serviceRoutes = require("./routes/services");
const providerRoutes = require("./routes/providers");
const doctorRoutes = require("./routes/doctors");
const profileRoutes = require("./routes/profile");
const zonesRoutes = require("./routes/zones");
const housesRoutes = require("./routes/houses");
const pipelinesRoutes = require("./routes/pipelines");
const powernodesRoutes = require("./routes/powernodes");
const publicLightsRoutes = require("./routes/publicLights");
const sensorsRoutes = require("./routes/sensors");
const smartBinsRoutes = require("./routes/smartBins");
const transportRoutes = require("./routes/transport");
const transportSchedulesRoutes = require("./routes/transportSchedules");
const infrastructureRoutes = require("./routes/infrastructure");
const routesRoutes = require("./routes/routes");
const propertiesRoutes = require("./routes/properties");
const departmentsRoutes = require("./routes/departments");
const maintenanceRoutes = require("./routes/maintenance");
const notificationsRoutes = require("./routes/notifications");
const adminRoutes = require("./routes/admin");
const auditLogsRoutes = require("./routes/auditLogs");

// New utility-specific routes
const fuelRoutes = require("./routes/fuel");
const waterRoutes = require("./routes/water");
const electricityRoutes = require("./routes/electricity");
const wasteManagementRoutes = require("./routes/wasteManagement");
const internetRoutes = require("./routes/internet");

// Register all routes
app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/citizens", citizenRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/utilities", utilityRoutes);
app.use("/api/healthcare", healthcareRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/zones", zonesRoutes);
app.use("/api/houses", housesRoutes);
app.use("/api/pipelines", pipelinesRoutes);
app.use("/api/powernodes", powernodesRoutes);
app.use("/api/public-lights", publicLightsRoutes);
app.use("/api/sensors", sensorsRoutes);
app.use("/api/smart-bins", smartBinsRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/transport-schedules", transportSchedulesRoutes);
app.use("/api/infrastructure", infrastructureRoutes);
app.use("/api/routes", routesRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/announcements", notificationsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/audit-logs", auditLogsRoutes);

console.log('✓ All routes registered successfully');

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Default route
app.get("/", (req, res) => {
  res.json({
    message: "Smart City Management System API",
    version: "1.0.0",
    documentation: `http://localhost:${PORT}/api/docs`,
    endpoints: {
      auth: "/api/auth",
      citizens: "/api/citizens",
      complaints: "/api/complaints",
      healthcare: "/api/healthcare",
      utilities: "/api/utilities",
      transport: "/api/transport",
      services: "/api/services",
      admin: "/api/admin",
      profile: "/api/profile"
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Endpoint not found",
    path: req.path,
    method: req.method
  });
});

// Centralized error handler
const { errorHandler } = require("./middleware/error");
app.use(errorHandler);

// Test DB connection at startup
const { db } = require('./db');
db.query('SELECT 1')
  .then(() => console.log('✓ Database connection successful'))
  .catch(err => console.error('✗ Database connection failed:', err.message));

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Smart City Management System API Server`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`${'='.repeat(60)}\n`);
}).on('error', err => {
  console.error('✗ Server failed to start:', err.message);
  process.exit(1);
});

module.exports = app;
