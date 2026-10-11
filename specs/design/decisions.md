# Technical decisions

- \[architecture\] One API service owns rooms and bookings, backed by one dedicated Postgres. *assumed* (all)
- \[data-model\] A booking stores the booker's display name taken from the gateway assertion at booking time. *assumed* (F1, F2)
- \[data-model\] Dates and hours are in the office's single local time zone; the API treats "today" and "past slot" in that zone. *assumed* (F1, F2)
- \[security\] Staff list rooms through GET /rooms (active only); the facilities admin loads every room, inactive included, through GET /admin/rooms. *assumed* (F1, F3)
- \[room-booking-api\] The no-overlap rule is enforced in the database so concurrent bookings cannot both succeed. *assumed* (F2)