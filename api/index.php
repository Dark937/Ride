<?php
/**
 * Ride — API Router (PHP/MySQL)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/helpers/JWT.php';

// ─── SECURITY HEADERS ────────────────────────────────────────────────────────
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 0");
header("Referrer-Policy: strict-origin-when-cross-origin");
header("Content-Type: application/json; charset=UTF-8");

// ─── CORS ────────────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed_origins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://ride.altervista.org' // Replace with your actual domain
];

if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// ─── ROUTING ─────────────────────────────────────────────────────────────────
$request_uri = $_SERVER['REQUEST_URI'];
// Remove subdirectory or /api/ prefix if present
$base_path = '/api';
if (strpos($request_uri, $base_path) === 0) {
    $request_uri = substr($request_uri, strlen($base_path));
}
// Remove query strings
$path = parse_url($request_uri, PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Helper to get JSON body
function get_input() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

// ─── AUTH MIDDLEWARE ───────────────────────────────────────────────────────── 
function authenticate() {
    $headers = getallheaders();
    $auth_header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!$auth_header || strpos($auth_header, 'Bearer ') !== 0) {
        http_response_code(401);
        echo json_encode(['error' => 'Access token required.']);
        exit;
    }
    
    $token = substr($auth_header, 7);
    $payload = JWT::decode($token, JWT_SECRET);
    
    if (!$payload) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid or expired token.']);
        exit;
    }
    
    return $payload; // ['userId' => ...]
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────
try {
    switch (true) {
        // AUTH
        case $path === '/register' && $method === 'POST':
            require_once __DIR__ . '/controllers/auth.php';
            register(get_input());
            break;
            
        case $path === '/login' && $method === 'POST':
            require_once __DIR__ . '/controllers/auth.php';
            login(get_input());
            break;

        case $path === '/auth/2fa/verify' && $method === 'POST':
            require_once __DIR__ . '/controllers/auth.php';
            verify_2fa(get_input());
            break;

        case $path === '/auth/forgot-password' && $method === 'POST':
            require_once __DIR__ . '/controllers/auth.php';
            forgot_password(get_input());
            break;

        case $path === '/auth/reset-password' && $method === 'POST':
            require_once __DIR__ . '/controllers/auth.php';
            reset_password(get_input());
            break;

        // PROFILE (Protected)
        case $path === '/profile' && $method === 'GET':
            $user = authenticate();
            require_once __DIR__ . '/controllers/profile.php';
            get_profile($user['userId']);
            break;

        case $path === '/profile' && $method === 'PATCH':
            $user = authenticate();
            require_once __DIR__ . '/controllers/profile.php';
            update_profile($user['userId'], get_input());
            break;

        case $path === '/auth/2fa/toggle' && $method === 'POST':
            $user = authenticate();
            require_once __DIR__ . '/controllers/auth.php';
            toggle_2fa($user['userId'], get_input());
            break;

        // BOOKINGS (Protected)
        case $path === '/bookings' && $method === 'GET':
            $user = authenticate();
            require_once __DIR__ . '/controllers/bookings.php';
            get_bookings($user['userId']);
            break;

        case $path === '/bookings' && $method === 'POST':
            $user = authenticate();
            require_once __DIR__ . '/controllers/bookings.php';
            create_booking($user['userId'], get_input());
            break;

        case preg_match('#^/bookings/([0-9]+)$#', $path, $matches) && $method === 'PUT':
            $user = authenticate();
            require_once __DIR__ . '/controllers/bookings.php';
            update_booking($user['userId'], $matches[1], get_input());
            break;

        case preg_match('#^/bookings/([0-9]+)$#', $path, $matches) && $method === 'DELETE':
            $user = authenticate();
            require_once __DIR__ . '/controllers/bookings.php';
            delete_booking($user['userId'], $matches[1]);
            break;

        case preg_match('#^/bookings/([0-9]+)/complete$#', $path, $matches) && $method === 'POST':
            $user = authenticate();
            require_once __DIR__ . '/controllers/bookings.php';
            complete_booking($user['userId'], $matches[1]);
            break;

        // FIDELITY (Protected)
        case $path === '/fidelity' && $method === 'GET':
            $user = authenticate();
            require_once __DIR__ . '/controllers/fidelity.php';
            get_fidelity($user['userId']);
            break;

        // DRIVER APPLICATIONS (Protected)
        case $path === '/apply-rider' && $method === 'POST':
            $user = authenticate();
            require_once __DIR__ . '/controllers/driver.php';
            apply_rider($user['userId'], get_input());
            break;

        default:
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint not found.']);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error: ' . $e->getMessage()]);
}
