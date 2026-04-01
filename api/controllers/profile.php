<?php
/**
 * Ride — Profile Controller (PHP/MySQL)
 */

function get_profile($userId) {
    $db = db_connect();
    $stmt = $db->prepare("SELECT id, first_name, last_name, email, initials, created_at, phone, city, country, birthday, account_type, photo, theme, lang, reduce_motion, two_fa_enabled, login_notif, n_push, n_sms, n_reminders, n_receipts, n_account, n_promo, p_share, p_marketing, p_analytics, p_location FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found.']);
        return;
    }

    // Map to frontend naming
    $resp = [
        'id'           => (int)$user['id'],
        'firstName'    => $user['first_name'],
        'lastName'     => $user['last_name'],
        'email'        => $user['email'],
        'initials'     => $user['initials'],
        'createdAt'    => $user['created_at'],
        'phone'        => $user['phone'],
        'city'         => $user['city'],
        'country'      => $user['country'],
        'birthday'     => $user['birthday'],
        'accountType'  => $user['account_type'],
        'photo'        => $user['photo'],
        'theme'        => $user['theme'],
        'lang'         => $user['lang'],
        'reduceMotion' => $user['reduce_motion'],
        'twoFaEnabled' => (bool)$user['two_fa_enabled'],
        'loginNotif'   => (bool)$user['login_notif'],
        'nPush'        => (bool)$user['n_push'],
        'nSms'         => (bool)$user['n_sms'],
        'nReminders'   => (bool)$user['n_reminders'],
        'nReceipts'    => (bool)$user['n_receipts'],
        'nAccount'     => (bool)$user['n_account'],
        'nPromo'       => (bool)$user['n_promo'],
        'pShare'       => (bool)$user['p_share'],
        'pMarketing'   => (bool)$user['p_marketing'],
        'pAnalytics'   => (bool)$user['p_analytics'],
        'pLocation'    => (bool)$user['p_location']
    ];

    echo json_encode(['user' => $resp]);
}

function update_profile($userId, $data) {
    $allowed = [
        'firstName'    => 'first_name',
        'lastName'     => 'last_name',
        'phone'        => 'phone',
        'city'         => 'city',
        'country'      => 'country',
        'birthday'     => 'birthday',
        'photo'        => 'photo',
        'theme'        => 'theme',
        'lang'         => 'lang',
        'reduceMotion' => 'reduce_motion',
        'loginNotif'   => 'login_notif',
        'nPush'        => 'n_push',
        'nSms'         => 'n_sms',
        'nReminders'   => 'n_reminders',
        'nReceipts'    => 'n_receipts',
        'nAccount'     => 'n_account',
        'nPromo'       => 'n_promo',
        'pShare'       => 'p_share',
        'pMarketing'   => 'p_marketing',
        'pAnalytics'   => 'p_analytics',
        'pLocation'    => 'p_location'
    ];

    $updates = [];
    $params  = [];

    foreach ($allowed as $jsKey => $col) {
        if (isset($data[$jsKey])) {
            $updates[] = "$col = ?";
            $params[]  = $data[$jsKey];
        }
    }

    if (empty($updates)) {
        get_profile($userId);
        return;
    }

    $db = db_connect();
    
    // Recalculate initials if name changes
    if (isset($data['firstName']) || isset($data['lastName'])) {
        $stmt = $db->prepare("SELECT first_name, last_name FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $curr = $stmt->fetch();
        $f = $data['firstName'] ?? $curr['first_name'];
        $l = $data['lastName'] ?? $curr['last_name'];
        $initials = strtoupper(substr($f, 0, 1) . substr($l, 0, 1));
        $updates[] = "initials = ?";
        $params[]  = $initials;
    }

    $params[] = $userId;
    $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
    $db->prepare($sql)->execute($params);

    get_profile($userId);
}
