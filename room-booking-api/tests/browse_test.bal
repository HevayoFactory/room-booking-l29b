import ballerina/http;
import ballerina/test;
import ballerina/time;

time:Civil browseNow = {year: 2026, month: 10, day: 12, hour: 10, minute: 30, second: 0};

@test:Config {}
function pagingIsClamped() {
    test:assertEquals(normalizePaging(20, 0), [20, 0]);
    test:assertEquals(normalizePaging(0, -5), [20, 0]);
    test:assertEquals(normalizePaging(1000, 3), [100, 3]);
}

@test:Config {}
function pageLinksPointAtNeighbours() {
    Room[] none = [];
    RoomList middle = roomPage(none, 50, "/rooms", 20, 20);
    test:assertEquals(middle?.next, "/rooms?limit=20&offset=40");
    test:assertEquals(middle?.previous, "/rooms?limit=20&offset=0");
    RoomList only = roomPage(none, 5, "/admin/rooms", 20, 0);
    test:assertEquals(only?.next, ());
    test:assertEquals(only?.previous, ());
    test:assertEquals(only.count, 5);
}

@test:Config {}
function roomRowKeepsFields() {
    Room room = toRoom({id: "r1", name: "Atlas", capacity: 8, location: "Floor 2, HQ", active: true});
    test:assertEquals(room.name, "Atlas");
    test:assertEquals(room.capacity, 8);
    test:assertEquals(room.location, "Floor 2, HQ");
}

@test:Config {}
function bookingRowShowsBooker() {
    Booking booking = toBooking({
        id: "b1", roomId: "r1", roomName: "Atlas", date: "2026-10-13", startHour: 9, endHour: 11,
        title: "Sync", bookedByName: "Test Staff", status: "active", cancelledBy: (), cancelReason: ()
    });
    test:assertEquals(booking.bookedByName, "Test Staff");
    test:assertEquals(booking?.title, "Sync");
    test:assertEquals(booking?.cancelledBy, ());
    test:assertEquals(booking.status, "active");
}

@test:Config {}
function dayQueryRules() {
    test:assertEquals(validateDayQuery("r1", "2026-10-12", browseNow), ());
    test:assertTrue(validateDayQuery("", "2026-10-12", browseNow) is string);
    test:assertTrue(validateDayQuery("r1", "2026-10-11", browseNow) is string);
    test:assertTrue(validateDayQuery("r1", "2026-11-12", browseNow) is string);
    test:assertTrue(validateDayQuery("r1", "nope", browseNow) is string);
}

// No assertion reaches the resource: it answers 401, never an anonymous 200.
@test:Config {}
function browseWithoutCallerIs401() returns error? {
    http:Client client1 = check new ("http://localhost:9090");
    foreach string path in ["/rooms", "/admin/rooms", "/bookings?roomId=r1&date=2026-10-12"] {
        http:Response res = check client1->get(path);
        test:assertEquals(res.statusCode, 401, path);
    }
}
