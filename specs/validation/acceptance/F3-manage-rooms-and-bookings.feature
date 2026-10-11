Feature: F3 Manage rooms and bookings

  @story-F3.1
  Rule: Only the facilities admin adds rooms

    Scenario: Adding a room
      When Nimal the facilities admin adds a room named uniquely for this run with capacity 6 on "Floor 1, Annex"
      Then that room is listed with capacity 6 and location "Floor 1, Annex"

    @negative
    Scenario: A duplicate room name
      Given a room named "Kandy" exists
      When Nimal tries to add another room named "Kandy"
      Then the number of rooms is unchanged

    @negative
    Scenario: Staff cannot add rooms
      When Asha looks for a way to add a room
      Then no way to add a room is available to her

  @story-F3.2
  Rule: The facilities admin edits a room's name, capacity and location

    Scenario: Changing capacity
      Given a room "Galle" with capacity 4 exists
      When Nimal changes the capacity of "Galle" to 5
      Then "Galle" is listed with capacity 5

  @story-F3.3 @story-F3.6
  Rule: A deactivated room is hidden from staff and can be reactivated

    Scenario: Deactivating a room
      Given "Sigiriya" is active
      When Nimal deactivates "Sigiriya"
      Then Asha does not see "Sigiriya" in the room list
      And Nimal still sees "Sigiriya" marked inactive

    Scenario: Reactivating a room
      Given "Sigiriya" is inactive
      When Nimal reactivates "Sigiriya"
      Then Asha sees "Sigiriya" in the room list

  @story-F3.3
  Rule: Deactivating a room cancels its future bookings

    Scenario: Future bookings are cancelled
      Given Asha has booked "Sigiriya" from 14:00 to 15:00 on a day next week
      When Nimal deactivates "Sigiriya"
      Then Asha's booking shows as cancelled by facilities

  @story-F3.4 @story-F3.5
  Rule: The facilities admin cancels any upcoming booking with an optional reason, which the booker sees

    Scenario: Cancelling with a reason
      Given Asha has booked "Kandy" from 13:00 to 14:00 on a day next week
      When Nimal cancels that booking with the reason "Projector maintenance"
      Then "Kandy" shows 13:00 as free on that day
      And Asha sees her booking cancelled by facilities with the reason "Projector maintenance"

    Scenario: Cancelling without a reason
      Given Asha has booked "Kandy" from 16:00 to 17:00 on a day next week
      When Nimal cancels that booking with no reason
      Then "Kandy" shows 16:00 as free on that day

  @story-F3.4
  Rule: Only the facilities admin cancels any booking

    @negative
    Scenario: Staff cannot cancel another person's booking
      Given Ravi has booked "Kandy" from 09:00 to 10:00 on a day next week
      When Asha looks for a way to cancel Ravi's booking
      Then Ravi's booking remains active
