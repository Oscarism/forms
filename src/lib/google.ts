/**
 * Google Sheets & Drive API Helpers
 * Uses service account authentication for server-side operations
 * Using lightweight individual packages instead of full googleapis
 */

import { sheets, type sheets_v4 } from '@googleapis/sheets';
import { drive, type drive_v3 } from '@googleapis/drive';
import { GoogleAuth } from 'google-auth-library';

let sheetsClient: sheets_v4.Sheets | null = null;
let driveClient: drive_v3.Drive | null = null;
let cachedCredentialsHash: string | null = null;

/**
 * Initialize Google API clients from service account credentials
 */
function initGoogleClients(serviceAccountJson: string): {
	sheets: sheets_v4.Sheets;
	drive: drive_v3.Drive;
} {
	// Simple hash to detect credential changes
	const credHash = serviceAccountJson.slice(0, 50);
	
	if (sheetsClient && driveClient && cachedCredentialsHash === credHash) {
		return { sheets: sheetsClient, drive: driveClient };
	}

	console.log('[Google] Initializing API clients...');
	
	try {
		const credentials = JSON.parse(serviceAccountJson);

		const auth = new GoogleAuth({
			credentials,
			scopes: [
				'https://www.googleapis.com/auth/spreadsheets',
				'https://www.googleapis.com/auth/drive.file'
			]
		});

		sheetsClient = sheets({ version: 'v4', auth });
		driveClient = drive({ version: 'v3', auth });
		cachedCredentialsHash = credHash;

		console.log('[Google] API clients initialized successfully');
		return { sheets: sheetsClient, drive: driveClient };
	} catch (error) {
		console.error('[Google] Failed to initialize clients:', error);
		throw error;
	}
}

/**
 * Append a row to a Google Sheet
 */
export async function appendToSheet(
	serviceAccountJson: string,
	sheetId: string,
	range: string,
	values: (string | number)[]
): Promise<void> {
	console.log('[Google] appendToSheet - sheetId:', sheetId, 'range:', range);
	
	try {
		const { sheets: sheetsApi } = initGoogleClients(serviceAccountJson);

		await sheetsApi.spreadsheets.values.append({
			spreadsheetId: sheetId,
			range,
			valueInputOption: 'USER_ENTERED',
			requestBody: {
				values: [values]
			}
		});
		
		console.log('[Google] appendToSheet - success');
	} catch (error) {
		console.error('[Google] appendToSheet - error:', error);
		throw error;
	}
}

/**
 * Get data from a Google Sheet
 */
export async function getSheetData(
	serviceAccountJson: string,
	sheetId: string,
	range: string
): Promise<string[][]> {
	console.log('[Google] getSheetData - sheetId:', sheetId, 'range:', range);
	
	try {
		const { sheets: sheetsApi } = initGoogleClients(serviceAccountJson);

		const response = await sheetsApi.spreadsheets.values.get({
			spreadsheetId: sheetId,
			range
		});

		console.log('[Google] getSheetData - success, rows:', response.data.values?.length || 0);
		return (response.data.values as string[][]) || [];
	} catch (error) {
		console.error('[Google] getSheetData - error:', error);
		throw error;
	}
}

/**
 * Update a specific cell in a Google Sheet
 */
export async function updateSheetCell(
	serviceAccountJson: string,
	sheetId: string,
	range: string,
	value: string
): Promise<void> {
	console.log('[Google] updateSheetCell - range:', range);
	
	try {
		const { sheets: sheetsApi } = initGoogleClients(serviceAccountJson);

		await sheetsApi.spreadsheets.values.update({
			spreadsheetId: sheetId,
			range,
			valueInputOption: 'USER_ENTERED',
			requestBody: {
				values: [[value]]
			}
		});
		
		console.log('[Google] updateSheetCell - success');
	} catch (error) {
		console.error('[Google] updateSheetCell - error:', error);
		throw error;
	}
}

/**
 * Create a folder in Google Drive
 */
export async function createDriveFolder(
	serviceAccountJson: string,
	parentFolderId: string,
	folderName: string
): Promise<string> {
	console.log('[Google] createDriveFolder - parent:', parentFolderId, 'name:', folderName);
	
	try {
		const { drive: driveApi } = initGoogleClients(serviceAccountJson);

		const response = await driveApi.files.create({
			requestBody: {
				name: folderName,
				mimeType: 'application/vnd.google-apps.folder',
				parents: [parentFolderId]
			},
			fields: 'id',
			supportsAllDrives: true
		});

		console.log('[Google] createDriveFolder - success, id:', response.data.id);
		return response.data.id || '';
	} catch (error) {
		console.error('[Google] createDriveFolder - error:', error);
		throw error;
	}
}

/**
 * Upload a file to Google Drive
 * Using Readable.from() for better Cloudflare Workers compatibility
 */
export async function uploadFileToDrive(
	serviceAccountJson: string,
	folderId: string,
	filename: string,
	mimeType: string,
	buffer: Buffer
): Promise<{ id: string; url: string }> {
	console.log('[Google] uploadFileToDrive - folder:', folderId, 'filename:', filename, 'size:', buffer.length);
	
	try {
		const { drive: driveApi } = initGoogleClients(serviceAccountJson);

		// Use Readable.from() which is more compatible with edge runtimes
		const { Readable } = await import('node:stream');
		const stream = Readable.from(buffer);

		console.log('[Google] uploadFileToDrive - starting upload...');
		
		const response = await driveApi.files.create({
			requestBody: {
				name: filename,
				parents: [folderId]
			},
			media: {
				mimeType,
				body: stream
			},
			fields: 'id, webViewLink, webContentLink',
			supportsAllDrives: true
		});

		const fileId = response.data.id || '';
		console.log('[Google] uploadFileToDrive - file created, id:', fileId);

		// Make file publicly viewable
		console.log('[Google] uploadFileToDrive - setting permissions...');
		await driveApi.permissions.create({
			fileId,
			requestBody: {
				role: 'reader',
				type: 'anyone'
			},
			supportsAllDrives: true
		});

		// Get the direct view link
		const viewUrl = `https://drive.google.com/uc?id=${fileId}`;

		console.log('[Google] uploadFileToDrive - success, url:', viewUrl);
		return {
			id: fileId,
			url: viewUrl
		};
	} catch (error) {
		console.error('[Google] uploadFileToDrive - error:', error);
		throw error;
	}
}

/**
 * Create client folder structure for form submissions
 * Returns the folder ID for file uploads
 */
export async function getOrCreateSubmissionFolder(
	serviceAccountJson: string,
	rootFolderId: string,
	clientName: string,
	submitterName: string
): Promise<string> {
	console.log('[Google] getOrCreateSubmissionFolder - root:', rootFolderId, 'client:', clientName, 'submitter:', submitterName);
	
	try {
		const { drive: driveApi } = initGoogleClients(serviceAccountJson);

		// Check if client folder exists
		console.log('[Google] Searching for existing client folder...');
		const clientFolderQuery = await driveApi.files.list({
			q: `name='${clientName}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
			fields: 'files(id, name)',
			supportsAllDrives: true,
			includeItemsFromAllDrives: true
		});

		let clientFolderId: string;

		if (clientFolderQuery.data.files && clientFolderQuery.data.files.length > 0) {
			clientFolderId = clientFolderQuery.data.files[0].id || '';
			console.log('[Google] Found existing client folder:', clientFolderId);
		} else {
			// Create client folder
			console.log('[Google] Creating new client folder...');
			clientFolderId = await createDriveFolder(serviceAccountJson, rootFolderId, clientName);
		}

		// Create submission folder with name and date
		const date = new Date().toISOString().split('T')[0];
		const slug = submitterName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');
		const folderName = `${slug}-${date}`;

		console.log('[Google] Creating submission folder:', folderName);
		const submissionFolderId = await createDriveFolder(
			serviceAccountJson,
			clientFolderId,
			folderName
		);

		console.log('[Google] getOrCreateSubmissionFolder - success, folderId:', submissionFolderId);
		return submissionFolderId;
	} catch (error) {
		console.error('[Google] getOrCreateSubmissionFolder - error:', error);
		throw error;
	}
}
