/**
 * POST /api/submit
 * Handle complete form submission
 * Uploads files to Google Drive and appends data to Google Sheet
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { appendToSheet } from '$lib/google';
import { uploadFileToDrive, getOrCreateSubmissionFolder } from '$lib/google';
import { generateThankYou } from '$lib/haiku';

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		console.log('Starting form submission...');
		const formData = await request.formData();

		// Get environment variables
		const serviceAccountJson =
			platform?.env?.GOOGLE_SERVICE_ACCOUNT_JSON ||
			import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON;
		const sheetId =
			platform?.env?.GOOGLE_SHEET_ID || import.meta.env.VITE_GOOGLE_SHEET_ID;
		const rootFolderId =
			platform?.env?.GOOGLE_DRIVE_FOLDER_ID || import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
		const anthropicKey =
			platform?.env?.ANTHROPIC_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY;

		console.log('Env check - sheetId:', !!sheetId, 'rootFolderId:', !!rootFolderId, 'serviceAccountJson:', !!serviceAccountJson);

		if (!serviceAccountJson || !sheetId || !rootFolderId) {
			console.error('Google credentials not configured');
			return json({ success: false, error: 'Service not configured' }, { status: 500 });
		}

		// Extract form fields
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const phoneExtension = formData.get('phone_extension') as string || '';
		const role = formData.get('role') as string || '';
		const department = formData.get('department') as string || '';
		const yearsExperience = formData.get('years_experience') as string || '';
		const specialty = formData.get('specialty') as string || '';
		const credentials = formData.get('credentials') as string || '';
		const favoriteService = formData.get('favorite_service') as string || '';
		const personalQuote = formData.get('personal_quote') as string || '';
		const bioShort = formData.get('bio_short') as string || '';
		const bioFull = formData.get('bio_full') as string || '';
		const anythingElse = formData.get('anything_else') as string || '';

		// Get files
		const profilePhoto = formData.get('profile_photo') as File | null;
		const additionalImages = formData.getAll('additional_images') as File[];
		const extraImages = formData.getAll('extra_images') as File[];

		console.log('Form data extracted - name:', name, 'email:', email, 'hasProfilePhoto:', !!profilePhoto);

		if (!name || !email) {
			return json({ success: false, error: 'Name and email are required' }, { status: 400 });
		}

		if (!profilePhoto) {
			return json({ success: false, error: 'Profile photo is required' }, { status: 400 });
		}

		console.log('Creating submission folder...');
		// Create submission folder
		const folderId = await getOrCreateSubmissionFolder(
			serviceAccountJson,
			rootFolderId,
			'The Fix',
			name
		);
		console.log('Folder created:', folderId);

		// Upload profile photo
		const profileBuffer = Buffer.from(await profilePhoto.arrayBuffer());
		const profileResult = await uploadFileToDrive(
			serviceAccountJson,
			folderId,
			`profile-${profilePhoto.name}`,
			profilePhoto.type,
			profileBuffer
		);

		// Upload additional images
		const additionalUrls: string[] = [];
		for (const file of additionalImages) {
			if (file.size > 0) {
				const buffer = Buffer.from(await file.arrayBuffer());
				const result = await uploadFileToDrive(
					serviceAccountJson,
					folderId,
					`additional-${file.name}`,
					file.type,
					buffer
				);
				additionalUrls.push(result.url);
			}
		}

		// Upload extra images
		const extraUrls: string[] = [];
		for (const file of extraImages) {
			if (file.size > 0) {
				const buffer = Buffer.from(await file.arrayBuffer());
				const result = await uploadFileToDrive(
					serviceAccountJson,
					folderId,
					`extra-${file.name}`,
					file.type,
					buffer
				);
				extraUrls.push(result.url);
			}
		}

		// Prepare row data for Google Sheet
		const timestamp = new Date().toISOString();
		const rowData = [
			timestamp,
			name,
			email,
			phoneExtension,
			role,
			department,
			yearsExperience,
			specialty,
			credentials,
			favoriteService,
			personalQuote,
			bioShort,
			bioFull,
			profileResult.url,
			additionalUrls.join(', '),
			anythingElse,
			extraUrls.join(', '),
			'New' // Status
		];

		// Append to Google Sheet
		await appendToSheet(serviceAccountJson, sheetId, 'Team Members!A:R', rowData);

		// Generate thank you message
		let thankYouMessage = `Thank you, ${name}! We really appreciate you taking the time to share your information.`;

		if (anthropicKey) {
			try {
				thankYouMessage = await generateThankYou(anthropicKey, name, role);
			} catch (error) {
				console.error('Failed to generate thank you message:', error);
				// Use default message
			}
		}

		return json({
			success: true,
			message: thankYouMessage
		});
	} catch (error) {
		console.error('Submit error:', error);
		return json({ success: false, error: 'Submission failed' }, { status: 500 });
	}
};
