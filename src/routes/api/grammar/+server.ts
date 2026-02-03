/**
 * POST /api/grammar
 * Grammar check using Claude Haiku
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { grammarCheck } from '$lib/haiku';

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const { text, context } = await request.json();

		if (!text) {
			return json({ success: false, error: 'Text required' }, { status: 400 });
		}

		const apiKey = platform?.env?.ANTHROPIC_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY;

		if (!apiKey) {
			console.error('ANTHROPIC_API_KEY not configured');
			return json({ success: false, error: 'AI service not configured' }, { status: 500 });
		}

		const corrected = await grammarCheck(apiKey, text, context);

		return json({ success: true, corrected });
	} catch (error) {
		console.error('Grammar check error:', error);
		return json({ success: false, error: 'Grammar check failed' }, { status: 500 });
	}
};
