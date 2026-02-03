/**
 * POST /api/auth
 * Validate admin password and create session
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validatePassword, createSession } from '$lib/auth';

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	try {
		const { password } = await request.json();

		if (!password) {
			return json({ success: false, error: 'Password required' }, { status: 400 });
		}

		// Get admin password from environment
		const adminPassword = platform?.env?.ADMIN_PASSWORD || import.meta.env.VITE_ADMIN_PASSWORD;

		if (!adminPassword) {
			console.error('ADMIN_PASSWORD not configured');
			return json({ success: false, error: 'Server configuration error' }, { status: 500 });
		}

		if (validatePassword(password, adminPassword)) {
			createSession(cookies);
			return json({ success: true });
		}

		return json({ success: false, error: 'Invalid password' }, { status: 401 });
	} catch (error) {
		console.error('Auth error:', error);
		return json({ success: false, error: 'Authentication failed' }, { status: 500 });
	}
};
