<?php
/**
 * Ride — API Configuration (PHP/MySQL)
 */

// ─── DATABASE SETTINGS ───────────────────────────────────────────────────────
// On Altervista, the host is usually 'localhost'.
// Check your Altervista control panel for the Username, Password, and DB Name.
define('DB_HOST', 'localhost');
define('DB_USER', 'ride'); 
define('DB_PASS', '9cpRQsEedtX6'); 
define('DB_NAME', 'my_ride'); // Usually starts with 'my_'

// ─── SECURITY SETTINGS ───────────────────────────────────────────────────────
define('JWT_SECRET', '2460d3916048cc382eab442411396e19b7e2d7bc6e7279376580bf8970364b53916b03997786e1061cc88b5385cce6cc620b84e37a6a8d09c4be095c9ee8db63');
define('JWT_EXPIRY', 7 * 24 * 60 * 60); // 7 days

// ─── AI SETTINGS ─────────────────────────────────────────────────────────────
define('ANTHROPIC_API_KEY', ''); // Get your key from anthropic.com

// ─── EMAIL SETTINGS ──────────────────────────────────────────────────────────
// Set to true to use Altervista's native mail() function (recommended).
// Set to false to use SMTP (requires a library like PHPMailer).
define('USE_NATIVE_MAIL', true);

// If USE_NATIVE_MAIL is false, fill these for SMTP:
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USER', '');
define('SMTP_PASS', '');

// ─── UTILS ───────────────────────────────────────────────────────────────────
function db_connect() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            header('Content-Type: application/json', true, 500);
            echo json_encode(['error' => 'Database connection failed.']);
            exit;
        }
    }
    return $pdo;
}

function send_email($to, $subject, $html) {
    if (USE_NATIVE_MAIL) {
        $headers  = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: Ride <noreply@" . $_SERVER['HTTP_HOST'] . ">" . "\r\n";
        return mail($to, $subject, $html, $headers);
    }
    // SMTP logic would require an external class; using native mail() as primary.
    return false;
}
