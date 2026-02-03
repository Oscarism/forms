import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	// Auth check is handled in layout.server.ts
	await parent();
	return {};
};
