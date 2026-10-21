<?php
/**
 * Unknown URL (Apache ErrorDocument 404): WordPress' "guess" redirect, as in
 * lib/site/guess.ts. If the last part of the URL matches a page or post slug,
 * 301 there; otherwise show the site's 404 page.
 */
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = rawurldecode($uri);
$segs = array_values(array_filter(explode('/', $path), 'strlen'));
$seg = strtolower((string) end($segs));

if ($seg !== '' && strlen($seg) >= 3 && !preg_match('/\.\w+$/', $seg)) {
    $paths = json_decode((string) @file_get_contents(__DIR__ . '/paths.json'), true) ?: [];
    $norm = '/' . implode('/', $segs) . '/';
    $paths = array_values(array_filter($paths, function ($p) use ($norm) { return $p['path'] !== $norm && $p['path'] !== '/'; }));
    usort($paths, function ($a, $b) {
        if ($a['type'] === $b['type']) return strlen($a['path']) - strlen($b['path']);
        return $a['type'] === 'page' ? -1 : 1;
    });
    $last = function ($p) { $s = array_values(array_filter(explode('/', $p), 'strlen')); return strtolower((string) end($s)); };
    $target = null;
    foreach ($paths as $p) { if ($last($p['path']) === $seg) { $target = $p['path']; break; } }
    if (!$target) foreach ($paths as $p) { if (strpos($last($p['path']), $seg) === 0) { $target = $p['path']; break; } }
    if ($target) {
        header('Location: ' . $target, true, 301);
        exit;
    }
}

http_response_code(404);
header('Content-Type: text/html; charset=UTF-8');
readfile(dirname(__DIR__) . '/404.html');
