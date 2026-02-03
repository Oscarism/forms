import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isAuthenticated } from '$lib/auth';

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	const authenticated = isAuthenticated(cookies);
	const isLoginPage = url.pathname === '/login';
	const isPublicForm = url.pathname.startsWith('/thefix');
	const isApiRoute = url.pathname.startsWith('/api');

	// Allow public forms and API routes without auth
	if (isPublicForm || isApiRoute) {
		return { isAuthenticated: authenticated };
	}

	// Redirect to login if not authenticated and not on login page
	if (!authenticated && !isLoginPage) {
		throw redirect(303, '/login');
	}

	// Redirect to dashboard if authenticated and on login page
	if (authenticated && isLoginPage) {
		throw redirect(303, '/');
	}

	return { isAuthenticated: authenticated };
};
