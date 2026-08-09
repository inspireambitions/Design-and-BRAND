<?php
/**
 * Plugin Name: IA Career Change Roadmap Bridge
 * Description: Serves the hosted Inspire Ambitions AI Career Coach at the canonical /career-change-roadmap path.
 * Version: 1.0.0
 * Author: Inspire Ambitions
 */

if (!defined('ABSPATH')) {
	exit;
}

final class IA_Career_Change_Roadmap_Bridge {
	private const PREFIX = '/career-change-roadmap';
	private const UPSTREAM = 'https://premium-career-coach.vercel.app';

	public static function boot(): void {
		add_action('template_redirect', array(__CLASS__, 'maybe_proxy'), -999);
	}

	private static function request_path(): string {
		$uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/';
		$path = (string) parse_url($uri, PHP_URL_PATH);
		return '/' . ltrim($path, '/');
	}

	private static function is_roadmap_request(string $path): bool {
		return $path === self::PREFIX || $path === self::PREFIX . '/' || strpos($path, self::PREFIX . '/') === 0;
	}

	private static function client_ip(): string {
		foreach (array('HTTP_CF_CONNECTING_IP', 'REMOTE_ADDR') as $key) {
			$value = isset($_SERVER[$key]) ? trim((string) $_SERVER[$key]) : '';
			if ($value !== '' && filter_var($value, FILTER_VALIDATE_IP)) {
				return $value;
			}
		}
		return '';
	}

	public static function maybe_proxy(): void {
		$path = self::request_path();
		if (!self::is_roadmap_request($path)) {
			return;
		}

		$method = strtoupper(isset($_SERVER['REQUEST_METHOD']) ? (string) $_SERVER['REQUEST_METHOD'] : 'GET');
		if (!in_array($method, array('GET', 'HEAD', 'POST'), true)) {
			status_header(405);
			header('Allow: GET, HEAD, POST');
			exit;
		}

		$request_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : self::PREFIX;
		$upstream_url = self::UPSTREAM . $request_uri;
		$headers = array(
			'Accept' => isset($_SERVER['HTTP_ACCEPT']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_ACCEPT'])) : '*/*',
			'User-Agent' => isset($_SERVER['HTTP_USER_AGENT']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_USER_AGENT'])) : 'Inspire Ambitions Roadmap Bridge',
			'X-IA-Bridge' => 'career-change-roadmap',
		);
		if (!empty($_SERVER['CONTENT_TYPE'])) {
			$headers['Content-Type'] = sanitize_text_field(wp_unslash($_SERVER['CONTENT_TYPE']));
		}
		$client_ip = self::client_ip();
		if ($client_ip !== '') {
			$headers['X-Forwarded-For'] = $client_ip;
			$headers['X-Real-IP'] = $client_ip;
		}

		$args = array(
			'method' => $method,
			'timeout' => 120,
			'redirection' => 0,
			'headers' => $headers,
			'decompress' => true,
		);
		if ($method === 'POST') {
			$args['body'] = file_get_contents('php://input');
		}

		$response = wp_remote_request($upstream_url, $args);
		if (is_wp_error($response)) {
			status_header(502);
			header('Content-Type: text/plain; charset=utf-8');
			header('Retry-After: 30');
			echo 'The career coach is temporarily unavailable. Please try again shortly.';
			exit;
		}

		$status = (int) wp_remote_retrieve_response_code($response);
		status_header($status > 0 ? $status : 502);
		header('X-IA-Career-Bridge: active');

		$response_headers = wp_remote_retrieve_headers($response);
		foreach (array('content-type', 'cache-control', 'content-disposition', 'etag', 'last-modified', 'vary', 'x-content-type-options') as $name) {
			$value = $response_headers[$name] ?? '';
			if ($value !== '') {
				header($name . ': ' . $value);
			}
		}

		$location = $response_headers['location'] ?? '';
		if ($location !== '') {
			$location = str_replace(self::UPSTREAM, home_url(), (string) $location);
			header('Location: ' . esc_url_raw($location), true, $status);
		}

		while (ob_get_level() > 0) {
			ob_end_clean();
		}
		if ($method !== 'HEAD') {
			echo wp_remote_retrieve_body($response); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- byte-for-byte upstream application response.
		}
		exit;
	}
}

IA_Career_Change_Roadmap_Bridge::boot();
