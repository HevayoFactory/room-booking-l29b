import ballerina/http;

listener http:Listener ep0 = new (9090);

// Feature operations are 501 placeholders until their items land.
function notImplemented() returns http:NotImplemented {
    return <http:NotImplemented>{body: errorBody(501, "not implemented")};
}

service http:InterceptableService / on ep0 {
    public function createInterceptors() returns AssertionInterceptor => new;

    # Every room, inactive ones included
    resource function get admin/rooms(int 'limit = 20, int offset = 0)
            returns RoomList|ErrorUnauthorized|http:NotImplemented {
        return notImplemented();
    }

    # Every active booking of a room on a day, with who booked it
    resource function get bookings(string roomId, string date, int 'limit = 20, int offset = 0)
            returns BookingList|ErrorBadRequest|ErrorUnauthorized|http:NotImplemented {
        return notImplemented();
    }

    # The caller's upcoming bookings
    resource function get me/bookings(int 'limit = 20, int offset = 0)
            returns BookingList|ErrorUnauthorized|http:NotImplemented {
        return notImplemented();
    }

    # Active rooms
    resource function get rooms(int 'limit = 20, int offset = 0)
            returns RoomList|ErrorUnauthorized|http:NotImplemented {
        return notImplemented();
    }

    # Edit, deactivate or reactivate a room
    resource function patch admin/rooms/[string roomId](@http:Payload RoomPatch payload)
            returns Room|ErrorBadRequest|ErrorUnauthorized|ErrorNotFound|ErrorConflict|http:NotImplemented {
        return notImplemented();
    }

    # Add a room
    resource function post admin/rooms(@http:Payload RoomInput payload)
            returns Room|ErrorBadRequest|ErrorUnauthorized|ErrorConflict|http:NotImplemented {
        return notImplemented();
    }

    # Cancel any upcoming booking
    resource function post bookings/[string bookingId]/cancel(@http:Payload CancelInput payload)
            returns BookingOk|ErrorBadRequest|ErrorUnauthorized|ErrorNotFound|http:NotImplemented {
        return notImplemented();
    }

    # Book consecutive free slots for the caller
    resource function post me/bookings(@http:Payload BookingInput payload)
            returns Booking|ErrorBadRequest|ErrorUnauthorized|ErrorNotFound|ErrorConflict|http:NotImplemented {
        return notImplemented();
    }

    # Cancel one of the caller's upcoming bookings
    resource function post me/bookings/[string bookingId]/cancel()
            returns BookingOk|ErrorBadRequest|ErrorUnauthorized|ErrorNotFound|http:NotImplemented {
        return notImplemented();
    }
}
