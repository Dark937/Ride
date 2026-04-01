<?php
/**
 * Ride — Fidelity Controller (PHP/MySQL)
 */

function get_fidelity($userId) {
    $db = db_connect();
    $stmt = $db->prepare("SELECT pts, redeemed, total_earned FROM fidelity WHERE user_id = ?");
    $stmt->execute([$userId]);
    $fid = $stmt->fetch();

    if (!$fid) {
        echo json_encode(['pts' => 0, 'redeemed' => 0, 'totalEarned' => 0]);
        return;
    }

    echo json_encode([
        'pts'         => (int)$fid['pts'],
        'redeemed'    => (int)$fid['redeemed'],
        'totalEarned' => (int)$fid['total_earned']
    ]);
}
