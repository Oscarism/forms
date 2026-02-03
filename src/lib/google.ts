/**
 * Google Sheets & Drive API Helpers
 * Uses service account authentication for server-side operations
 */

import { google } from 'googleapis';
import type { drive_v3, sheets_v4 } from 'googleapis';

let sheetsClient: sheets_v4.Sheets | null = null;
let driveClient: drive_v3.Drive | null = null;

/**
 * Initialize Google API clients from service account credentials
 */
function initGoogleClients(serviceAccountJson: string): {
	sheets: sheets_v4.Sheets;
	drive: drive_v3.Drive;
} {
	if (sheetsClient && driveClient) {
		return { sheets: sheetsClient, drive: driveClient };
	}

	const credentials = JSON.parse(serviceAccountJson);

	const auth = new google.auth.GoogleAuth({
		credentials,
		scopes: [
			'https://www.googleapis.com/auth/spreadsheets',
			'https://www.googleapis.com/auth/drive.file'
		]
	});

	sheetsClient = google.sheets({ version: 'v4', auth });
	driveClient = google.drive({ version: 'v3', auth });

	return { sheets: sheetsClient, drive: driveClient };
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
	const { sheets } = initGoogleClients(serviceAccountJson);

	await sheets.spreadsheets.values.append({
		spreadsheetId: sheetId,
		range,
		valueInputOption: 'USER_ENTERED',
		requestBody: {
			values: [values]
		}
	});
}

/**
 * Get data from a Google Sheet
 */
export async function getSheetData(
	serviceAccountJson: string,
	sheetId: string,
	range: string
): Promise<string[][]> {
	const { sheets } = initGoogleClients(serviceAccountJson);

	const response = await sheets.spreadsheets.values.get({
		spreadsheetId: sheetId,
		range
	});

	return (response.data.values as string[][]) || [];
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
	const { sheets } = initGoogleClients(serviceAccountJson);

	await sheets.spreadsheets.values.update({
		spreadsheetId: sheetId,
		range,
		valueInputOption: 'USER_ENTERED',
		requestBody: {
			values: [[value]]
		}
	});
}

/**
 * Create a folder in Google Drive
 */
export async function createDriveFolder(
	serviceAccountJson: string,
	parentFolderId: string,
	folderName: string
): Promise<string> {
	const { drive } = initGoogleClients(serviceAccountJson);

	const response = await drive.files.create({
		requestBody: {
			name: folderName,
			mimeType: 'application/vnd.google-apps.folder',
			parents: [parentFolderId]
		},
		fields: 'id',
		supportsAllDrives: true
	});

	return response.data.id || '';
}

/**
 * Upload a file to Google Drive
 */
export async function uploadFileToDrive(
	serviceAccountJson: string,
	folderId: string,
	filename: string,
	mimeType: string,
	buffer: Buffer
): Promise<{ id: string; url: string }> {
	const { drive } = initGoogleClients(serviceAccountJson);

	// Create readable stream from buffer
	const { Readable } = await import('stream');
	const stream = new Readable();
	stream.push(buffer);
	stream.push(null);

	const response = await drive.files.create({
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

	// Make file publicly viewable
	await drive.permissions.create({
		fileId,
		requestBody: {
			role: 'reader',
			type: 'anyone'
		},
		supportsAllDrives: true
	});

	// Get the direct view link
	const viewUrl = `https://drive.google.com/uc?id=${fileId}`;

	return {
		id: fileId,
		url: viewUrl
	};
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
	const { drive } = initGoogleClients(serviceAccountJson);

	// Check if client folder exists
	const clientFolderQuery = await drive.files.list({
		q: `name='${clientName}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
		fields: 'files(id, name)',
		supportsAllDrives: true,
		includeItemsFromAllDrives: true
	});

	let clientFolderId: string;

	if (clientFolderQuery.data.files && clientFolderQuery.data.files.length > 0) {
		clientFolderId = clientFolderQuery.data.files[0].id || '';
	} else {
		// Create client folder
		clientFolderId = await createDriveFolder(serviceAccountJson, rootFolderId, clientName);
	}

	// Create submission folder with name and date
	const date = new Date().toISOString().split('T')[0];
	const slug = submitterName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
	const folderName = `${slug}-${date}`;

	const submissionFolderId = await createDriveFolder(
		serviceAccountJson,
		clientFolderId,
		folderName
	);

	return submissionFolderId;
}
