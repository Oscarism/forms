/**
 * GET /api/submissions
 * Get submissions from Google Sheet (requires auth)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAuthenticated } from '$lib/auth';
import { getSheetData, updateSheetCell } from '$lib/google';

export const GET: RequestHandler = async ({ cookies, url, platform }) => {
	// Check authentication
	if (!isAuthenticated(cookies)) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const serviceAccountJson =
			platform?.env?.GOOGLE_SERVICE_ACCOUNT_JSON ||
			import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON;
		const sheetId =
			platform?.env?.GOOGLE_SHEET_ID || import.meta.env.VITE_GOOGLE_SHEET_ID;

		if (!serviceAccountJson || !sheetId) {
			return json({ success: false, error: 'Service not configured' }, { status: 500 });
		}

		const statusFilter = url.searchParams.get('status');

		// Get all data from sheet
		const data = await getSheetData(serviceAccountJson, sheetId, 'Team Members!A:R');
		console.log('Sheet data rows:', data.length);

		// Skip header row and map to objects
		const submissions = data.slice(1).map((row, index) => ({
			rowIndex: index + 2, // +2 because: 1-indexed and skip header
			timestamp: row[0] || '',
			name: row[1] || '',
			email: row[2] || '',
			phoneExtension: row[3] || '',
			role: row[4] || '',
			department: row[5] || '',
			yearsExperience: row[6] || '',
			specialty: row[7] || '',
			credentials: row[8] || '',
			favoriteService: row[9] || '',
			personalQuote: row[10] || '',
			bioShort: row[11] || '',
			bioFull: row[12] || '',
			profilePhotoUrl: row[13] || '',
			additionalImagesUrls: row[14] || '',
			anythingElse: row[15] || '',
			extraImagesUrls: row[16] || '',
			status: row[17] || 'New'
		}));

		console.log('Submissions found:', submissions.length);

		// Filter by status if provided
		const filtered = statusFilter
			? submissions.filter((s) => s.status === statusFilter)
			: submissions;

		// Sort by timestamp descending (newest first)
		filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

		return json({ success: true, submissions: filtered });
	} catch (error) {
		console.error('Get submissions error:', error);
		return json({ success: false, error: 'Failed to fetch submissions' }, { status: 500 });
	}
};

/**
 * PATCH /api/submissions
 * Update submission status
 */
export const PATCH: RequestHandler = async ({ cookies, request, platform }) => {
	// Check authentication
	if (!isAuthenticated(cookies)) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { rowIndex, status } = await request.json();

		if (!rowIndex || !status) {
			return json({ success: false, error: 'Row index and status required' }, { status: 400 });
		}

		const validStatuses = ['New', 'Reviewed', 'Added'];
		if (!validStatuses.includes(status)) {
			return json({ success: false, error: 'Invalid status' }, { status: 400 });
		}

		const serviceAccountJson =
			platform?.env?.GOOGLE_SERVICE_ACCOUNT_JSON ||
			import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON;
		const sheetId =
			platform?.env?.GOOGLE_SHEET_ID || import.meta.env.VITE_GOOGLE_SHEET_ID;

		if (!serviceAccountJson || !sheetId) {
			return json({ success: false, error: 'Service not configured' }, { status: 500 });
		}

		// Update status column (R)
		await updateSheetCell(
			serviceAccountJson,
			sheetId,
			`Team Members!R${rowIndex}`,
			status
		);

		return json({ success: true });
	} catch (error) {
		console.error('Update status error:', error);
		return json({ success: false, error: 'Failed to update status' }, { status: 500 });
	}
};
