<?php
/**
 * Ride — Bookings Controller (PHP/MySQL)
 */

function map_booking($row) {
    return [
        '_id'         => (int)$row['id'], // frontend compat
        'id'          => (int)$row['id'],
        'userId'      => (int)$row['user_id'],
        'from'        => $row['from_loc'],
        'to'          => $row['to_loc'],
        'fromLat'     => $row['from_lat'],
        'fromLng'     => $row['from_lng'],
        'toLat'       => $row['to_lat'],
        'toLng'       => $row['to_lng'],
        'datetime'    => $row['datetime'],
        'car'         => $row['car'],
        'carId'       => $row['car_id'],
        'fare'        => (float)$row['fare'],
        'durationMin' => (int)$row['duration_min'],
        'distKm'      => (float)$row['dist_km'],
        'passengers'  => (int)$row['passengers'],
        'notes'       => $row['notes'],
        'driver'      => $row['driver'],
        'status'      => $row['status'],
        'pts'         => (int)$row['pts'],
        'completedAt' => $row['completed_at'],
        'createdAt'   => $row['created_at']
    ];
}

function get_bookings($userId) {
    $db = db_connect();
    $stmt = $db->prepare("SELECT * FROM bookings WHERE user_id = ? ORDER BY datetime DESC LIMIT 200");
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll();
    echo json_encode(array_map('map_booking', $rows));
}

function create_booking($userId, $data) {
    if (empty($data['from']) || empty($data['to']) || empty($data['datetime']) || empty($data['car']) || !isset($data['fare'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields.']);
        return;
    }

    $db = db_connect();
    $newStart = strtotime($data['datetime']);
    if (!$newStart) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid datetime.']);
        return;
    }
    $duration = (int)($data['durationMin'] ?? 30);
    $newEnd = $newStart + ($duration * 60);

    // Conflict check
    $stmt = $db->prepare("SELECT id, datetime, duration_min FROM bookings WHERE user_id = ? AND status = 'upcoming'");
    $stmt->execute([$userId]);
    $existing = $stmt->fetchAll();
    
    foreach ($existing as $b) {
        $bS = strtotime($b['datetime']);
        $bE = $bS + ($b['duration_min'] * 60);
        if ($newStart < $bE && $newEnd > $bS) {
            http_response_code(409);
            echo json_encode(['error' => 'You already have a booking during this time.', 'conflict' => (int)$b['id']]);
            return;
        }
    }

    $stmt = $db->prepare("INSERT INTO bookings (user_id, from_loc, to_loc, from_lat, from_lng, to_lat, to_lng, datetime, car, car_id, fare, duration_min, dist_km, passengers, notes, driver, pts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    $stmt->execute([
        $userId,
        substr($data['from'], 0, 500),
        substr($data['to'], 0, 500),
        $data['fromLat'] ?? NULL,
        $data['fromLng'] ?? NULL,
        $data['toLat'] ?? NULL,
        $data['toLng'] ?? NULL,
        date('Y-m-d H:i:s', $newStart),
        substr($data['car'], 0, 100),
        substr($data['carId'] ?? '', 0, 50),
        (float)$data['fare'],
        $duration,
        (float)($data['distKm'] ?? 0),
        max(1, min(7, (int)($data['passengers'] ?? 1))),
        substr($data['notes'] ?? '', 0, 500),
        substr($data['driver'] ?? '', 0, 100),
        round((float)$data['fare'])
    ]);

    $id = (int)$db->lastInsertId();
    $stmt = $db->prepare("SELECT * FROM bookings WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(map_booking($stmt->fetch()), JSON_PRETTY_PRINT);
}

function update_booking($userId, $id, $data) {
    $db = db_connect();
    $stmt = $db->prepare("SELECT * FROM bookings WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $userId]);
    $row = $stmt->fetch();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Booking not found.']);
        return;
    }
    if ($row['status'] !== 'upcoming') {
        http_response_code(400);
        echo json_encode(['error' => 'Only upcoming bookings can be edited.']);
        return;
    }

    $newDatetime = $row['datetime'];
    if (!empty($data['datetime'])) {
        $newStart = strtotime($data['datetime']);
        $newEnd = $newStart + ($row['duration_min'] * 60);

        $stmt = $db->prepare("SELECT id, datetime, duration_min FROM bookings WHERE user_id = ? AND status = 'upcoming' AND id != ?");
        $stmt->execute([$userId, $id]);
        $existing = $stmt->fetchAll();
        foreach ($existing as $b) {
            $bS = strtotime($b['datetime']);
            $bE = $bS + ($b['duration_min'] * 60);
            if ($newStart < $bE && $newEnd > $bS) {
                http_response_code(409);
                echo json_encode(['error' => 'Time conflicts with another booking.']);
                return;
            }
        }
        $newDatetime = date('Y-m-d H:i:s', $newStart);
    }

    $passengers = isset($data['passengers']) ? max(1, min(7, (int)$data['passengers'])) : $row['passengers'];
    $notes      = isset($data['notes']) ? substr($data['notes'], 0, 500) : $row['notes'];

    $stmt = $db->prepare("UPDATE bookings SET datetime = ?, passengers = ?, notes = ? WHERE id = ?");
    $stmt->execute([$newDatetime, $passengers, $notes, $id]);

    $stmt = $db->prepare("SELECT * FROM bookings WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(map_booking($stmt->fetch()));
}

function delete_booking($userId, $id) {
    $db = db_connect();
    $stmt = $db->prepare("SELECT id, status FROM bookings WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $userId]);
    $row = $stmt->fetch();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Booking not found.']);
        return;
    }
    if ($row['status'] !== 'upcoming') {
        http_response_code(400);
        echo json_encode(['error' => 'Only upcoming bookings can be cancelled.']);
        return;
    }

    $stmt = $db->prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['ok' => true]);
}

function complete_booking($userId, $id) {
    $db = db_connect();
    $stmt = $db->prepare("SELECT id, status, fare, pts FROM bookings WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $userId]);
    $row = $stmt->fetch();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Booking not found.']);
        return;
    }
    if ($row['status'] !== 'upcoming') {
        echo json_encode(['ok' => true, 'alreadyDone' => true]);
        return;
    }

    $completedAt = date('Y-m-d H:i:s');
    $stmt = $db->prepare("UPDATE bookings SET status = 'completed', completed_at = ? WHERE id = ?");
    $stmt->execute([$completedAt, $id]);

    $pts = (int)($row['pts'] ?: round($row['fare']));

    // Upsert fidelity
    $stmt = $db->prepare("INSERT INTO fidelity (user_id, pts, redeemed, total_earned) VALUES (?, ?, 0, ?) ON DUPLICATE KEY UPDATE pts = pts + VALUES(pts), total_earned = total_earned + VALUES(total_earned)");
    $stmt->execute([$userId, $pts, $pts]);

    $stmt = $db->prepare("SELECT * FROM fidelity WHERE user_id = ?");
    $stmt->execute([$userId]);
    $fid = $stmt->fetch();

    echo json_encode([
        'ok'       => true,
        'pts'      => $pts,
        'fidelity' => ['pts' => (int)$fid['pts'], 'redeemed' => (int)$fid['redeemed'], 'totalEarned' => (int)$fid['total_earned']]
    ]);
}
