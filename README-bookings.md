Frontend integration notes: My Services

Purpose
- The frontend "My Services" page should show a citizen's bookings grouped by service category (water, electricity, internet, transport, waste, healthcare).

API endpoints
- GET /api/bookings/citizen/:citizen_id
  - Returns bookings with service and category fields. Use this to populate the "My Services" sections.
- GET /api/bookings/category/:category_id
  - For departmental dashboards to list bookings relevant to a department.
- POST /api/bookings
  - Create a booking. Required fields: citizen_id, service_id, booking_start. Optional: booking_end, details, priority.
- PUT /api/bookings/:booking_id
  - Update status, assignment, or schedule.

Suggested frontend behavior
- On "My Services", call GET /api/bookings/citizen/:id, then group results by category_name.
- Allow rescheduling and cancellation by calling PUT /api/bookings/:id to update booking_start or status.
- Show status badges (upcoming, scheduled, in_progress, completed, cancelled, no_show).

Notes
- Booking times are stored as DATETIME; timezone handling should be consistent between frontend and backend.
- Authentication required: endpoints use `authenticateToken` middleware; ensure frontend sends JWT.
