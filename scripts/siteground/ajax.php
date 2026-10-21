<?php
/**
 * SiteGround version of app/wp-admin/admin-ajax.php/route.ts + lib/lead.ts:
 * the Elementor forms post here (via .htaccess, from /wp-admin/admin-ajax.php)
 * and get the same JSON answer WordPress gave. The lead goes to the
 * GoHighLevel webhook. Settings: forms.json (written by export-static.mjs).
 */
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

function reply($body, $status = 200) {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function fail($message, $status = 200) {
    reply(['success' => false, 'data' => ['message' => $message, 'errors' => [], 'data' => []]], $status);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || ($_POST['action'] ?? '') !== 'elementor_pro_forms_send_form') {
    header('Content-Type: text/plain');
    http_response_code(400);
    echo '0';
    exit;
}

$config = json_decode((string) @file_get_contents(__DIR__ . '/forms.json'), true) ?: [];
$postId = (string) ($_POST['post_id'] ?? '');
$formId = (string) ($_POST['form_id'] ?? '');
$labels = $config['labels']["$postId:$formId"] ?? [];

// Field IDs (field_89fc83e) become their labels (Phone).
$fields = [];
$raw = $_POST['form_fields'] ?? [];
if (is_array($raw)) {
    foreach ($raw as $id => $value) {
        if (is_array($value)) $value = implode(', ', array_map('strval', $value));
        $value = (string) $value;
        $label = (isset($labels[$id]) && $labels[$id] !== $id) ? $labels[$id] : (string) $id;
        $fields[$label] = isset($fields[$label]) ? $fields[$label] . ', ' . $value : $value;
    }
}
$page = (string) ($_POST['referrer'] ?? ($_SERVER['HTTP_REFERER'] ?? ''));

// Honeypot fields must stay empty.
foreach ($fields as $k => $v) {
    if (stripos($k, 'honeypot') !== false && $v !== '') fail('Please confirm you are not a robot and try again.');
}

// Form settings (name, thank-you page, message, tag).
$setting = null;
foreach (($config['forms'] ?? []) as $f) {
    if (($f['formKey'] ?? '') === "$postId:$formId") { $setting = $f; break; }
}
if (!$setting) {
    foreach (($config['forms'] ?? []) as $f) {
        $key = $f['formKey'] ?? '';
        if (substr($key, -strlen(":$formId")) === ":$formId" && strpos($key, "$postId:") === 0) { $setting = $f; break; }
    }
}

function pick($fields, $re, $not = null) {
    foreach ($fields as $k => $v) {
        if (preg_match($re, $k) && (!$not || !preg_match($not, $k))) return $v;
    }
    return '';
}
function phone_e164($raw) {
    $d = preg_replace('/\D/', '', $raw);
    if (strlen($d) === 10) return "+1$d";
    if (strlen($d) === 11 && $d[0] === '1') return "+$d";
    return trim($raw);
}

$name = pick($fields, '/^(full )?name$/i') ?: ($fields['name'] ?? '');
$parts = preg_split('/\s+/', trim($name)) ?: [''];
$first = array_shift($parts);
$phone = pick($fields, '/phone/i');
$tags = ['website-lead'];
if (!empty($setting['tag'])) $tags[] = $setting['tag'];

$payload = [
    'source' => 'Website form',
    'form' => $setting['name'] ?? "$postId:$formId",
    'tags' => $tags,
    'submitted_at' => gmdate('Y-m-d\TH:i:s.000\Z'),
    'name' => $name,
    'first_name' => $first ?: '',
    'last_name' => implode(' ', $parts),
    'email' => pick($fields, '/e-?mail/i'),
    'phone' => phone_e164($phone),
    'phone_raw' => $phone,
    'address' => pick($fields, '/address/i', '/e-?mail/i'),
    'postal_code' => pick($fields, '/zip|postal/i'),
    'service_needed' => pick($fields, '/service|treatment/i'),
    'page_url' => $page,
    'fields' => (object) $fields,
];

function post_json($url, $data) {
    $body = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    for ($attempt = 0; $attempt < 2; $attempt++) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
        ]);
        curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($status >= 200 && $status < 300) return true;
        error_log("[lead] webhook answered $status $err");
        if ($status !== 429 && $status >= 400 && $status < 500) return false;
        usleep(600000);
    }
    return false;
}

$webhook = (string) ($config['webhook'] ?? '');
if ($webhook === '' || !post_json($webhook, $payload)) {
    $phoneText = ($config['phone'] ?? '') !== '' ? ' Please call us at ' . $config['phone'] . '.' : '';
    fail('Something went wrong.' . $phoneText);
}

$data = [];
if (!empty($setting['redirect'])) {
    $redirect = $setting['redirect'];
    if (!preg_match('#^https?://#', $redirect)) {
        $scheme = 'https';
        $redirect = $scheme . '://' . $_SERVER['HTTP_HOST'] . '/' . ltrim($redirect, '/');
    }
    $data['redirect_url'] = $redirect;
}
reply(['success' => true, 'data' => ['message' => $setting['message'] ?? 'Your submission was successful.', 'data' => (object) $data]]);
