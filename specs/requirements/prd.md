# Room Booking

## Problem Statement

Staff have no single place to see which meeting rooms are free and reserve one, so rooms get double-booked and facilities cannot manage the room list or clear conflicting bookings.

## Solution

A web app and API where signed-in staff browse meeting rooms and book a one-hour slot today or later, and a facilities admin maintains the rooms and can cancel any booking.

## Actors

- Staff — signs in, sees rooms and their availability, books a room for a slot, and cancels their own bookings.
- Facilities admin — signs in, adds rooms, and cancels any booking. Does not book rooms.

## Features

- F1 [Browse rooms and availability](features/F1-browse-rooms-and-availability.md)
- F2 [Book a room](features/F2-book-a-room.md)
- F3 [Manage rooms and bookings](features/F3-manage-rooms-and-bookings.md)

## Product-wide

See [Product-wide](product-wide.md).

## Out of Scope

- Notifications (email or chat) about bookings.
- Recurring bookings.
- Booking by facilities admin.

