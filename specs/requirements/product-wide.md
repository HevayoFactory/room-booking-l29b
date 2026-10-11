# Product-wide

Rules that apply to more than one feature.

## Requirements

- P1 Users sign in before using the app; the two roles are staff and facilities admin. \[org default\] Applies to: all.
- P2 A room cannot have two active bookings for the same slot. Applies to: F2, F3.
- P3 Bookings are for fixed one-hour slots, today or later; past slots cannot be booked. Applies to: F1, F2.

## Decisions

- Sign-in is SSO through the platform identity provider. \[org default\]
- Slots are fixed one-hour slots.