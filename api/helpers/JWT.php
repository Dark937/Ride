<?php
/**
 * Ride — Simple JWT Handler (HS256)
 */

class JWT {
    /**
     * Encode payload to JWT string
     */
    public static function encode($payload, $secret) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        
        $base64UrlHeader = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode(json_encode($payload));
        
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
        $base64UrlSignature = self::base64UrlEncode($signature);
        
        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    /**
     * Decode JWT string to payload or return false on error
     */
    public static function decode($jwt, $secret) {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) return false;
        
        list($header64, $payload64, $signature64) = $parts;
        
        $signature = self::base64UrlDecode($signature64);
        $expectedSignature = hash_hmac('sha256', $header64 . "." . $payload64, $secret, true);
        
        if (!hash_equals($signature, $expectedSignature)) {
            return false;
        }
        
        $payload = json_decode(self::base64UrlDecode($payload64), true);
        
        // Check expiry if set (iat, exp)
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return false;
        }
        
        return $payload;
    }

    private static function base64UrlEncode($data) {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }

    private static function base64UrlDecode($data) {
        $urlSafeData = str_replace(['-', '_'], ['+', '/'], $data);
        $remainder = strlen($urlSafeData) % 4;
        if ($remainder) {
            $urlSafeData .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode($urlSafeData);
    }
}
