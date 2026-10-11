# Domain model

Rooms are bookable in fixed one-hour slots; a booking holds one room, one day and a run of consecutive slots.

```mermaid
erDiagram
    Room ||--o{ Booking : "is booked in"
    Room {
        string id
        string name "unique"
        int capacity
        string location "floor/building"
        boolean active
    }
    Booking {
        string id
        string roomId
        string date "YYYY-MM-DD"
        int startHour "08..17"
        int endHour "09..18, exclusive"
        string title "optional"
        string bookerId "gateway subject"
        string bookerName
        string status "active|cancelled"
        string cancelledBy "booker|facilities"
        string cancelReason "optional"
    }
```

- A booking occupies hours startHour to endHour; no two active bookings of a room overlap on a date.
- Deactivating a room cancels its future active bookings with cancelledBy facilities.