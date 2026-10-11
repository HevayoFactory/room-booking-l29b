# Book a room

## Purpose

Staff book a room for a one-hour slot today or later, and cancel their own bookings.

Needs: F1.

## User Stories

- F2.1 As a staff member, I book a room for one free one-hour slot, today or up to 30 days ahead.
- F2.2 As a staff member, I book several consecutive free slots in the same room as one booking.
- F2.3 As a staff member, I add an optional title to my booking.
- F2.4 As a staff member, I am told when a slot was taken by someone else before I confirmed, and nothing is booked.
- F2.5 As a staff member, I see my upcoming bookings in one list.
- F2.6 As a staff member, I cancel my own booking, which frees its slots.
- F2.7 As a staff member, I cannot cancel other people's bookings.

## Decisions

- A staff member can hold any number of bookings.
- A booking is for one room on one day and covers consecutive one-hour slots.
- Any room books straight away; no room needs facilities approval before a booking holds.
- Staff can cancel only their own upcoming bookings; past bookings cannot be cancelled.

## Out of Scope

- Editing a booking; staff cancel and rebook instead.
- Inviting attendees.