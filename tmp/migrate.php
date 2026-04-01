<?php
require_once 'c:\Users\Giulio\Downloads\Ride\api\config.php';
$db = db_connect();
$queries = [
    "ALTER TABLE users ADD COLUMN login_notif TINYINT(1) DEFAULT 1",
    "ALTER TABLE users ADD COLUMN n_push TINYINT(1) DEFAULT 1",
    "ALTER TABLE users ADD COLUMN n_sms TINYINT(1) DEFAULT 1",
    "ALTER TABLE users ADD COLUMN n_reminders TINYINT(1) DEFAULT 1",
    "ALTER TABLE users ADD COLUMN n_receipts TINYINT(1) DEFAULT 1",
    "ALTER TABLE users ADD COLUMN n_account TINYINT(1) DEFAULT 1",
    "ALTER TABLE users ADD COLUMN n_promo TINYINT(1) DEFAULT 0",
    "ALTER TABLE users ADD COLUMN p_share TINYINT(1) DEFAULT 0",
    "ALTER TABLE users ADD COLUMN p_marketing TINYINT(1) DEFAULT 0",
    "ALTER TABLE users ADD COLUMN p_analytics TINYINT(1) DEFAULT 1",
    "ALTER TABLE users ADD COLUMN p_location TINYINT(1) DEFAULT 1"
];

foreach ($queries as $q) {
    try {
        $db->exec($q);
        echo "Executed: $q\n";
    } catch (Exception $e) {
        echo "Error executing $q: " . $e->getMessage() . "\n";
    }
}
