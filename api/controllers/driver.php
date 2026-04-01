<?php
/**
 * Ride — Driver Controller (PHP/MySQL)
 */

function apply_rider($userId, $data) {
    if (empty($data['firstName']) || empty($data['lastName']) || empty($data['phone']) || empty($data['city']) || !isset($data['experience']) || empty($data['licenseNumber']) || empty($data['statement'])) {
        http_response_code(400);
        echo json_encode(['error' => 'All fields are required.']);
        return;
    }

    if (strlen($data['statement']) < 20) {
        http_response_code(400);
        echo json_encode(['error' => 'Personal statement must be at least 20 characters.']);
        return;
    }

    $db   = db_connect();
    $stmt = $db->prepare("SELECT email, account_type FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found.']);
        return;
    }

    if ($user['account_type'] === 'rider') {
        http_response_code(400);
        echo json_encode(['error' => 'Account is already a driver account.']);
        return;
    }

    // Rate limit: max 3 apps per 24 hours
    $yesterday = date('Y-m-d H:i:s', time() - 86400);
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM driver_applications WHERE user_id = ? AND created_at >= ?");
    $stmt->execute([$userId, $yesterday]);
    $count = $stmt->fetch()['count'];

    if ($count >= 3) {
        http_response_code(429);
        echo json_encode(['error' => 'You have already submitted 3 applications today. Please try again in 24 hours.']);
        return;
    }

    // Insert application
    $stmt = $db->prepare("INSERT INTO driver_applications (user_id, first_name, last_name, email, phone, city, experience, license_number, statement) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $userId,
        $data['firstName'],
        $data['lastName'],
        $user['email'],
        $data['phone'],
        $data['city'],
        (int)$data['experience'],
        $data['licenseNumber'],
        $data['statement']
    ]);
    
    $appId = $db->lastInsertId();
    $decision = 'pending';
    $aiReason = 'Manual review requested.';

    // AI Review with Claude
    if (defined('ANTHROPIC_API_KEY') && !empty(ANTHROPIC_API_KEY)) {
        $prompt = "You are reviewing a driver application for a luxury ride-hailing service. Analyze the application and decide if it should be approved or rejected.\n\nApplicant: {$data['firstName']} {$data['lastName']}\nCity: {$data['city']}\nDriving experience: {$data['experience']} years\nLicense number: {$data['licenseNumber']}\nPersonal statement: {$data['statement']}\n\nApproval criteria: at least 2 years driving experience, professional tone.\n\nRespond with ONLY valid JSON: {\"decision\":\"approved\",\"reason\":\"brief reason\"} or {\"decision\":\"rejected\",\"reason\":\"brief reason\"}";

        $ch = curl_init('https://api.anthropic.com/v1/messages');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'x-api-key: ' . ANTHROPIC_API_KEY,
            'anthropic-version: 2023-06-01',
            'content-type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'model'      => 'claude-3-haiku-20240307',
            'max_tokens' => 256,
            'messages'   => [['role' => 'user', 'content' => $prompt]]
        ]));

        $response = curl_exec($ch);
        if ($response) {
            $resData = json_decode($response, true);
            $raw = isset($resData['content'][0]['text']) ? trim($resData['content'][0]['text']) : '';
            $parsed = json_decode($raw, true);
            if ($parsed && in_array($parsed['decision'], ['approved', 'rejected'])) {
                $decision = $parsed['decision'];
                $aiReason = substr($parsed['reason'] ?? '', 0, 500);
            }
        }
        curl_close($ch);
    }

    // Update with decision
    $stmt = $db->prepare("UPDATE driver_applications SET decision = ?, ai_reason = ? WHERE id = ?");
    $stmt->execute([$decision, $aiReason, $appId]);

    if ($decision === 'approved') {
        $db->prepare("UPDATE users SET account_type = 'rider' WHERE id = ?")->execute([$userId]);
    }

    if ($decision !== 'pending') {
        $subject = ($decision === 'approved' ? 'Welcome to the Ride team!' : 'Your Ride driver application');
        $msg = "<h2>Hi {$data['firstName']},</h2><p>Your application has been <strong>$decision</strong>.</p><p>Reason: $aiReason</p>";
        send_email($user['email'], $subject, $msg);
    }

    echo json_encode(['ok' => true, 'decision' => $decision, 'reason' => $aiReason]);
}
