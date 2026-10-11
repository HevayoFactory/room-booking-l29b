Feature: F1 Browse rooms and availability

  @story-F1.1
  Rule: Staff see each active room with its name, capacity and location

    Scenario: The room list
      Given the room "Kandy" with capacity 8 on "Floor 2, Main building" is active
      When Asha opens the rooms and availability page
      Then "Kandy" is listed with capacity 8 and location "Floor 2, Main building"

  @story-F1.1
  Rule: Staff do not see deactivated rooms

    @negative
    Scenario: A deactivated room is hidden from staff
      Given the room "Ella" has been deactivated
      When Asha opens the rooms and availability page
      Then "Ella" is not listed

  @story-F1.2 @story-F1.3
  Rule: A day shows every one-hour slot from 08:00 to 18:00 as free or taken, with who holds a taken slot

    Scenario: A day with one booking
      Given Ravi has booked "Kandy" from 09:00 to 10:00 for a day next week, titled "Design sync"
      When Asha views "Kandy" on that day
      Then the slots run from 08:00 to 18:00 in one-hour steps
      And the 09:00 slot shows as taken by "Ravi Silva"
      And the 10:00 slot shows as free

  @story-F1.2
  Rule: Staff can view only today up to 30 days ahead

    @negative
    Scenario: A day beyond 30 days
      When Asha views "Kandy" on a day 31 days from today
      Then no slot on that day can be booked

  @story-F1.4
  Rule: Slots already past today are not available

    @negative
    Scenario: A past slot today
      Given the time is 11:30 today
      When Asha views "Kandy" for today
      Then the 08:00 slot cannot be booked

  @story-F1.5
  Rule: The facilities admin sees the same availability, including who booked each slot

    Scenario: Admin sees the booker
      Given Ravi has booked "Kandy" from 09:00 to 10:00 for a day next week
      When Nimal the facilities admin views "Kandy" on that day
      Then the 09:00 slot shows as taken by "Ravi Silva"
