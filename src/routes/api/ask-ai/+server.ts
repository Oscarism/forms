/**
 * POST /api/ask-ai
 * Ask AI questions using Claude Haiku
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { askAI } from '$lib/haiku';

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const { text, question, brandContext } = await request.json();

		if (!text || !question) {
			return json({ success: false, error: 'Text and question required' }, { status: 400 });
		}

		const apiKey = platform?.env?.ANTHROPIC_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY;

		if (!apiKey) {
			console.error('ANTHROPIC_API_KEY not configured');
			return json({ success: false, error: 'AI service not configured' }, { status: 500 });
		}

		const response = await askAI(apiKey, text, question, brandContext);

		return json({ success: true, response });
	} catch (error) {
		console.error('Ask AI error:', error);
		return json({ success: false, error: 'AI request failed' }, { status: 500 });
	}
};
