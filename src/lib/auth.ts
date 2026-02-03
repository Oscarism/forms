/**
 * Authentication Utilities
 * Simple password-based auth for admin dashboard
 */

import { type Cookies } from '@sveltejs/kit';

const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_DURATION_HOURS = 24;

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return result === 0;
}

/**
 * Validate password against stored password
 */
export function validatePassword(input: string, stored: string): boolean {
	return constantTimeCompare(input, stored);
}

/**
 * Generate a simple session token
 */
function generateSessionToken(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create and set session cookie
 */
export function createSession(cookies: Cookies): void {
	const token = generateSessionToken();

	cookies.set(SESSION_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'strict',
		maxAge: SESSION_DURATION_HOURS * 60 * 60
	});
}

/**
 * Check if user has a valid session
 */
export function isAuthenticated(cookies: Cookies): boolean {
	const session = cookies.get(SESSION_COOKIE_NAME);
	return !!session && session.length === 64;
}

/**
 * Clear the session cookie (logout)
 */
export function clearSession(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}
