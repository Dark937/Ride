<?php
/**
 * Ride — Auth Controller (PHP/MySQL)
 */

function register($data) {
    if (empty($data['firstName']) || empty($data['lastName']) || empty($data['email']) || empty($data['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'All fields are required.']);
        return;
    }

    $db = db_connect();
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([strtolower($data['email'])]);
    if ($stmt->fetch()) {
        http_response_code(400);
        echo json_encode(['error' => 'Email already registered.']);
        return;
    }

    $passwordHash = password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]);
    $initials = strtoupper(substr($data['firstName'], 0, 1) . substr($data['lastName'], 0, 1));

    $stmt = $db->prepare("INSERT INTO users (first_name, last_name, email, password, initials) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([
        trim($data['firstName']),
        trim($data['lastName']),
        strtolower(trim($data['email'])),
        $passwordHash,
        $initials
    ]);

    $userId = $db->lastInsertId();
    $token  = JWT::encode(['userId' => (int)$userId, 'exp' => time() + JWT_EXPIRY], JWT_SECRET);

    send_email($data['email'], 'Welcome to Ride!', "<h2>Hi {$data['firstName']},</h2><p>Welcome to Ride! Your account has been created successfully.</p>");

    echo json_encode(['user' => ['id' => $userId, 'email' => $data['email'], 'firstName' => $data['firstName']], 'token' => $token]);
}

function login($data) {
    if (empty($data['email']) || empty($data['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Email and password are required.']);
        return;
    }

    $db   = db_connect();
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([strtolower($data['email'])]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($data['password'], $user['password'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid email or password.']);
        return;
    }

    // 2FA logic
    if ($user['two_fa_enabled']) {
        $code = (string)rand(100000, 999999);
        $expiry = date('Y-m-d H:i:s', time() + 600); // 10 min
        $stmt = $db->prepare("UPDATE users SET two_fa_code = ?, two_fa_expiry = ? WHERE id = ?");
        $stmt->execute([$code, $expiry, $user['id']]);

        send_email($user['email'], 'Your Ride sign-in code', "<h2>Your code: $code</h2>");
        
        $tempToken = JWT::encode(['userId' => (int)$user['id'], 'twoFaPending' => true, 'exp' => time() + 600], JWT_SECRET);
        echo json_encode(['twoFaRequired' => true, 'tempToken' => $tempToken]);
        return;
    }

    $token = JWT::encode(['userId' => (int)$user['id'], 'exp' => time() + JWT_EXPIRY], JWT_SECRET);
    
    // Minimal user object for response
    $respUser = [
        'id'        => (int)$user['id'],
        'firstName' => $user['first_name'],
        'lastName'  => $user['last_name'],
        'email'     => $user['email'],
        'initials'  => $user['initials'],
        'photo'     => $user['photo']
    ];
    
    echo json_encode(['user' => $respUser, 'token' => $token]);
}

function verify_2fa($data) {
    if (empty($data['tempToken']) || empty($data['code'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Token and code required.']);
        return;
    }

    $payload = JWT::decode($data['tempToken'], JWT_SECRET);
    if (!$payload || empty($payload['twoFaPending'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired session.']);
        return;
    }

    $db = db_connect();
    $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$payload['userId']]);
    $user = $stmt->fetch();

    if (!$user || $user['two_fa_code'] !== $data['code'] || strtotime($user['two_fa_expiry']) < time()) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired code.']);
        return;
    }

    // Clear code
    $db->prepare("UPDATE users SET two_fa_code = NULL, two_fa_expiry = NULL WHERE id = ?")->execute([$user['id']]);
    
    $token = JWT::encode(['userId' => (int)$user['id'], 'exp' => time() + JWT_EXPIRY], JWT_SECRET);
    echo json_encode(['user' => ['id' => $user['id'], 'email' => $user['email']], 'token' => $token]);
}

function forgot_password($data) {
    if (empty($data['email'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Email required.']);
        return;
    }

    $db = db_connect();
    $stmt = $db->prepare("SELECT id, first_name, email FROM users WHERE email = ?");
    $stmt->execute([strtolower($data['email'])]);
    $user = $stmt->fetch();

    if ($user) {
        $token = bin2hex(random_bytes(32));
        $expiry = date('Y-m-d H:i:s', time() + 3600); // 1 hour
        $db->prepare("UPDATE users SET password_reset_token = ?, password_reset_expiry = ? WHERE id = ?")
           ->execute([$token, $expiry, $user['id']]);
        
        $link = "https://" . $_SERVER['HTTP_HOST'] . "/reset-password.html?token=$token";
        send_email($user['email'], 'Reset your Ride password', "<p>Hi {$user['first_name']},</p><p>Click here to reset: <a href='$link'>Reset Password</a></p>");
    }

    echo json_encode(['ok' => true]); // Always return OK for security
}

function reset_password($data) {
    if (empty($data['token']) || empty($data['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Token and password required.']);
        return;
    }

    $db = db_connect();
    $stmt = $db->prepare("SELECT id FROM users WHERE password_reset_token = ? AND password_reset_expiry > ?");
    $stmt->execute([$data['token'], date('Y-m-d H:i:s')]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or expired token.']);
        return;
    }

    $hash = password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]);
    $db->prepare("UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expiry = NULL WHERE id = ?")
       ->execute([$hash, $user['id']]);

    echo json_encode(['ok' => true]);
}

function toggle_2fa($userId, $data) {
    if (!isset($data['enabled'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Enabled flag required.']);
        return;
    }

    $db = db_connect();
    $db->prepare("UPDATE users SET two_fa_enabled = ?, two_fa_code = NULL, two_fa_expiry = NULL WHERE id = ?")
       ->execute([$data['enabled'] ? 1 : 0, $userId]);

    echo json_encode(['ok' => true, 'twoFaEnabled' => (bool)$data['enabled']]);
}
