# Manage rooms and bookings

## Purpose

A facilities admin adds rooms and cancels any booking.

Needs: F1.

## User Stories

- F3.1 As a facilities admin, I add a room with a name, capacity and location.
- F3.2 As a facilities admin, I edit a room's name, capacity and location.
- F3.3 As a facilities admin, I deactivate a room so it no longer appears for booking.
- F3.4 As a facilities admin, I cancel any booking, with an optional reason.
- F3.5 As a staff member, I see the reason when my booking was cancelled by a facilities admin.
- F3.6 As a facilities admin, I reactivate a deactivated room.

## Decisions

- Deactivating a room cancels all its future bookings; the bookers see them as cancelled by facilities.
- Rooms are deactivated, never deleted, so past bookings keep their room.
- A cancelled slot becomes free for booking again.
- Room names are unique.

## Out of Scope

- Deleting rooms.
- Notifying bookers of a cancellation by email or chat.