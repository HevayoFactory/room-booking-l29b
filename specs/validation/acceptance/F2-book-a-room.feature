Feature: F2 Book a room

  @story-F2.1 @story-F2.3
  Rule: Staff book a free one-hour slot, today or up to 30 days ahead, with an optional title

    Scenario: Booking one slot with a title
      Given "Galle" is free from 10:00 to 11:00 on a day next week
      When Asha books "Galle" from 10:00 to 11:00 on that day with the title "Interview"
      Then "Galle" shows 10:00 as taken by "Asha Perera" on that day
      And "Interview" appears in her bookings

    Scenario: Booking without a title
      Given "Galle" is free from 15:00 to 16:00 on a day next week
      When Asha books "Galle" from 15:00 to 16:00 on that day with no title
      Then her bookings include "Galle" from 15:00 to 16:00

  @story-F2.2
  Rule: Several consecutive free slots form one booking

    Scenario: Booking two hours
      Given "Kandy" is free from 13:00 to 15:00 on a day next week
      When Asha books "Kandy" from 13:00 to 15:00 on that day
      Then her bookings list one booking for "Kandy" from 13:00 to 15:00

    @negative
    Scenario: An end time before the start time
      When Asha tries to book "Kandy" from 15:00 to 14:00
      Then no booking is added to her bookings

  @story-F2.1
  Rule: A past slot or a day beyond 30 days cannot be booked

    @negative
    Scenario: A day 31 days ahead
      When Asha tries to book "Kandy" from 09:00 to 10:00 on a day 31 days from today
      Then no booking is added to her bookings

  @story-F2.4
  Rule: A slot already taken cannot be booked again

    @negative
    Scenario: Booking a taken slot
      Given Ravi has booked "Kandy" from 09:00 to 10:00 on a day next week
      When Asha tries to book "Kandy" from 09:00 to 10:00 on that day
      Then her bookings do not change
      And "Kandy" still shows 09:00 as taken by "Ravi Silva"

    @negative
    Scenario: A range that overlaps a taken slot
      Given Ravi has booked "Kandy" from 10:00 to 11:00 on a day next week
      When Asha tries to book "Kandy" from 09:00 to 11:00 on that day
      Then her bookings do not change

  @story-F2.5
  Rule: Staff see their own upcoming bookings in one list

    Scenario: My bookings
      Given Asha has booked "Galle" from 10:00 to 11:00 on a day next week
      When Asha opens her bookings
      Then the list shows "Galle" from 10:00 to 11:00 on that day

  @story-F2.6
  Rule: Staff cancel their own upcoming booking and its slots become free

    Scenario: Cancelling my booking
      Given Asha has booked "Galle" from 10:00 to 11:00 on a day next week
      When Asha cancels that booking
      Then "Galle" shows 10:00 as free on that day

  @story-F2.7
  Rule: Only the booker cancels a booking, apart from facilities

    @negative
    Scenario: Cancelling someone else's booking
      Given Ravi has booked "Kandy" from 09:00 to 10:00 on a day next week
      When Asha looks for a way to cancel Ravi's booking
      Then Ravi's booking remains active
