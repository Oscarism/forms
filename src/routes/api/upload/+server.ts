/**
 * POST /api/upload
 * Upload a single file to Google Drive
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uploadFileToDrive, getOrCreateSubmissionFolder } from '$lib/google';

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const submitterName = formData.get('submitterName') as string;
		const clientName = formData.get('clientName') as string || 'The Fix';

		if (!file) {
			return json({ success: false, error: 'File required' }, { status: 400 });
		}

		if (!submitterName) {
			return json({ success: false, error: 'Submitter name required' }, { status: 400 });
		}

		// Get environment variables
		const serviceAccountJson = platform?.env?.GOOGLE_SERVICE_ACCOUNT_JSON || import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON;
		const rootFolderId = platform?.env?.GOOGLE_DRIVE_FOLDER_ID || import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;

		if (!serviceAccountJson || !rootFolderId) {
			console.error('Google Drive credentials not configured');
			return json({ success: false, error: 'File storage not configured' }, { status: 500 });
		}

		// Create submission folder
		const folderId = await getOrCreateSubmissionFolder(
			serviceAccountJson,
			rootFolderId,
			clientName,
			submitterName
		);

		// Upload file
		const buffer = Buffer.from(await file.arrayBuffer());
		const result = await uploadFileToDrive(
			serviceAccountJson,
			folderId,
			file.name,
			file.type,
			buffer
		);

		return json({
			success: true,
			id: result.id,
			url: result.url
		});
	} catch (error) {
		console.error('Upload error:', error);
		return json({ success: false, error: 'File upload failed' }, { status: 500 });
	}
};
