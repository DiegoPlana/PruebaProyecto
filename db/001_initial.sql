CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE admins (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
 password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, admin_id uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
 csrf text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE rooms (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL UNIQUE, description text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true
);
CREATE TABLE beds (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 room_id integer NOT NULL REFERENCES rooms(id), label text NOT NULL, active boolean NOT NULL DEFAULT true,
 UNIQUE(room_id,label)
);
CREATE TABLE bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'PENDIENTE' CHECK(status IN ('PENDIENTE','ACEPTADA','RECHAZADA')),
 mode text NOT NULL CHECK(mode IN ('ROOM','BEDS')),
 first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL, phone text NOT NULL,
 notes text NOT NULL DEFAULT '', arrival date NOT NULL, departure date NOT NULL,
 people integer NOT NULL CHECK(people > 0), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(departure > arrival)
);
CREATE TABLE allocations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 booking_id uuid REFERENCES bookings(id), bed_id integer NOT NULL REFERENCES beds(id),
 period daterange NOT NULL CHECK(NOT isempty(period) AND NOT lower_inf(period) AND NOT upper_inf(period)),
 active boolean NOT NULL DEFAULT true, reason text,
 CHECK(booking_id IS NOT NULL OR reason IS NOT NULL),
 EXCLUDE USING gist (bed_id WITH =, period WITH &&) WHERE (active)
);
CREATE INDEX allocations_booking ON allocations(booking_id);
CREATE INDEX bookings_dates ON bookings(arrival,departure);
CREATE TABLE stays (
 booking_id uuid PRIMARY KEY REFERENCES bookings(id), accepted_at timestamptz NOT NULL DEFAULT now(),
 checked_in_at timestamptz, checked_out_at timestamptz,
 CHECK(checked_out_at IS NULL OR (checked_in_at IS NOT NULL AND checked_out_at >= checked_in_at))
);
CREATE TABLE restaurant_slots (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, date date NOT NULL, time time NOT NULL,
 capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 500), closed boolean NOT NULL DEFAULT false,
 UNIQUE(date,time)
);
CREATE TABLE restaurant_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text NOT NULL UNIQUE,
 slot_id integer NOT NULL REFERENCES restaurant_slots(id),
 status text NOT NULL DEFAULT 'PENDIENTE' CHECK(status IN ('PENDIENTE','ACEPTADA','RECHAZADA')),
 people integer NOT NULL CHECK(people > 0), first_name text NOT NULL, last_name text NOT NULL,
 email text NOT NULL, phone text NOT NULL, notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurant_requests_slot ON restaurant_requests(slot_id,status);
CREATE TABLE idempotency (
 key uuid PRIMARY KEY, fingerprint text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor uuid REFERENCES admins(id),
 action text NOT NULL, entity_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
