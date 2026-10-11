import ballerina/constraint;
import ballerina/http;

public type ErrorConflict record {|
    *http:Conflict;
    Error body;
|};

public type Error record {
    # HTTP or application error code
    int code;
    # short human-readable label
    string message;
    # detailed explanation
    string description?;
    # URI to documentation
    string moreInfo?;
};

public type ErrorBadRequest record {|
    *http:BadRequest;
    Error body;
|};

public type Booking record {
    string id;
    string roomId;
    string roomName;
    string date;
    # first booked hour, 24-hour clock
    @constraint:Int {minValue: 8, maxValue: 17}
    int startHour;
    # end of the last booked hour, exclusive
    @constraint:Int {minValue: 9, maxValue: 18}
    int endHour;
    string? title?;
    # person shown as the booker
    string bookedByName;
    "active"|"cancelled" status;
    "booker"|"facilities"? cancelledBy?;
    string? cancelReason?;
};

public type ErrorNotFound record {|
    *http:NotFound;
    Error body;
|};

public type CancelInput record {
    # shown to the booker
    string? reason?;
};

public type RoomInput record {
    # unique among rooms
    string name;
    @constraint:Int {minValue: 1}
    int capacity;
    string location;
};

public type BookingOk record {|
    *http:Ok;
    Booking body;
|};

public type RoomPatch record {
    string name?;
    @constraint:Int {minValue: 1}
    int capacity?;
    string location?;
    # false deactivates the room and cancels its future bookings
    boolean active?;
};

public type RoomList record {
    int count;
    string? next?;
    string? previous?;
    Room[] data;
};

public type BookingList record {
    int count;
    string? next?;
    string? previous?;
    Booking[] data;
};

public type BookingInput record {
    string roomId;
    # today up to 30 days ahead
    string date;
    @constraint:Int {minValue: 8, maxValue: 17}
    int startHour;
    # exclusive; later than startHour
    @constraint:Int {minValue: 9, maxValue: 18}
    int endHour;
    string? title?;
};

public type Room record {
    string id;
    string name;
    @constraint:Int {minValue: 1}
    int capacity;
    # floor and building
    string location;
    # false when hidden from booking
    boolean active;
};

public type ErrorUnauthorized record {|
    *http:Unauthorized;
    Error body;
|};
