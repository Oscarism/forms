/**
 * Google Sheets & Drive API Helpers
 * Uses direct REST API calls for Cloudflare Workers compatibility
 * (The @googleapis/* packages have Node.js dependencies that don't work in Workers)
 */

interface TokenCache {
	token: string;
	expiry: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Create a JWT and exchange it for an access token
 */
async function getAccessToken(serviceAccountJson: string): Promise<string> {
	// Check cache
	if (tokenCache && Date.now() < tokenCache.expiry) {
		return tokenCache.token;
	}

	console.log('[Google] Getting new access token...');
	
	const credentials = JSON.parse(serviceAccountJson);
	
	// Create JWT header and payload
	const header = {
		alg: 'RS256',
		typ: 'JWT'
	};

	const now = Math.floor(Date.now() / 1000);
	const payload = {
		iss: credentials.client_email,
		scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
		aud: 'https://oauth2.googleapis.com/token',
		iat: now,
		exp: now + 3600
	};

	// Base64url encode
	const base64url = (obj: object) => {
		const json = JSON.stringify(obj);
		const base64 = btoa(json);
		return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	};

	const headerB64 = base64url(header);
	const payloadB64 = base64url(payload);
	const signatureInput = `${headerB64}.${payloadB64}`;

	// Sign with private key
	const privateKey = credentials.private_key;
	const pemContents = privateKey
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\n/g, '');
	
	const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
	
	const cryptoKey = await crypto.subtle.importKey(
		'pkcs8',
		binaryKey,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);

	const signatureBuffer = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		cryptoKey,
		new TextEncoder().encode(signatureInput)
	);

	const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

	const jwt = `${signatureInput}.${signatureB64}`;

	// Exchange JWT for access token
	const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
	});

	if (!tokenResponse.ok) {
		const error = await tokenResponse.text();
		console.error('[Google] Token exchange failed:', error);
		throw new Error(`Token exchange failed: ${error}`);
	}

	const tokenData = await tokenResponse.json() as { access_token: string; expires_in: number };
	
	// Cache the token (with 5 minute buffer)
	tokenCache = {
		token: tokenData.access_token,
		expiry: Date.now() + (tokenData.expires_in - 300) * 1000
	};

	console.log('[Google] Got access token successfully');
	return tokenData.access_token;
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
	
	const token = await getAccessToken(serviceAccountJson);
	
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
	
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ values: [values] })
	});

	if (!response.ok) {
		const error = await response.text();
		console.error('[Google] appendToSheet error:', error);
		throw new Error(`Failed to append to sheet: ${error}`);
	}

	console.log('[Google] appendToSheet - success');
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
	
	const token = await getAccessToken(serviceAccountJson);
	
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
	
	const response = await fetch(url, {
		headers: { 'Authorization': `Bearer ${token}` }
	});

	if (!response.ok) {
		const error = await response.text();
		console.error('[Google] getSheetData error:', error);
		throw new Error(`Failed to get sheet data: ${error}`);
	}

	const data = await response.json() as { values?: string[][] };
	console.log('[Google] getSheetData - success, rows:', data.values?.length || 0);
	
	return data.values || [];
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
	
	const token = await getAccessToken(serviceAccountJson);
	
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
	
	const response = await fetch(url, {
		method: 'PUT',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ values: [[value]] })
	});

	if (!response.ok) {
		const error = await response.text();
		console.error('[Google] updateSheetCell error:', error);
		throw new Error(`Failed to update cell: ${error}`);
	}

	console.log('[Google] updateSheetCell - success');
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
	
	const token = await getAccessToken(serviceAccountJson);
	
	const response = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			name: folderName,
			mimeType: 'application/vnd.google-apps.folder',
			parents: [parentFolderId]
		})
	});

	if (!response.ok) {
		const error = await response.text();
		console.error('[Google] createDriveFolder error:', error);
		throw new Error(`Failed to create folder: ${error}`);
	}

	const data = await response.json() as { id: string };
	console.log('[Google] createDriveFolder - success, id:', data.id);
	
	return data.id;
}

/**
 * Upload a file to Google Drive using multipart upload
 */
export async function uploadFileToDrive(
	serviceAccountJson: string,
	folderId: string,
	filename: string,
	mimeType: string,
	buffer: Buffer
): Promise<{ id: string; url: string }> {
	console.log('[Google] uploadFileToDrive - folder:', folderId, 'filename:', filename, 'size:', buffer.length);
	
	const token = await getAccessToken(serviceAccountJson);
	
	// Create multipart body
	const boundary = '-------314159265358979323846';
	const metadata = JSON.stringify({
		name: filename,
		parents: [folderId]
	});

	// Build multipart request body
	const bodyParts = [
		`--${boundary}\r\n`,
		'Content-Type: application/json; charset=UTF-8\r\n\r\n',
		metadata,
		`\r\n--${boundary}\r\n`,
		`Content-Type: ${mimeType}\r\n\r\n`
	];

	const textEncoder = new TextEncoder();
	const prefix = textEncoder.encode(bodyParts.join(''));
	const suffix = textEncoder.encode(`\r\n--${boundary}--`);

	// Combine all parts
	const body = new Uint8Array(prefix.length + buffer.length + suffix.length);
	body.set(prefix, 0);
	body.set(new Uint8Array(buffer), prefix.length);
	body.set(suffix, prefix.length + buffer.length);

	console.log('[Google] uploadFileToDrive - starting upload...');
	
	const response = await fetch(
		'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,webContentLink',
		{
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': `multipart/related; boundary=${boundary}`
			},
			body
		}
	);

	if (!response.ok) {
		const error = await response.text();
		console.error('[Google] uploadFileToDrive error:', error);
		throw new Error(`Failed to upload file: ${error}`);
	}

	const data = await response.json() as { id: string };
	const fileId = data.id;
	
	console.log('[Google] uploadFileToDrive - file created, id:', fileId);

	// Make file publicly viewable
	console.log('[Google] uploadFileToDrive - setting permissions...');
	
	const permResponse = await fetch(
		`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
		{
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				role: 'reader',
				type: 'anyone'
			})
		}
	);

	if (!permResponse.ok) {
		const error = await permResponse.text();
		console.error('[Google] uploadFileToDrive permission error:', error);
		// Don't throw - file was uploaded, just permission failed
	}

	const viewUrl = `https://drive.google.com/uc?id=${fileId}`;
	console.log('[Google] uploadFileToDrive - success, url:', viewUrl);
	
	return { id: fileId, url: viewUrl };
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
	
	const token = await getAccessToken(serviceAccountJson);

	// Check if client folder exists
	console.log('[Google] Searching for existing client folder...');
	
	const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
		`name='${clientName}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
	)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`;
	
	const searchResponse = await fetch(searchUrl, {
		headers: { 'Authorization': `Bearer ${token}` }
	});

	if (!searchResponse.ok) {
		const error = await searchResponse.text();
		console.error('[Google] Folder search error:', error);
		throw new Error(`Failed to search folders: ${error}`);
	}

	const searchData = await searchResponse.json() as { files: Array<{ id: string; name: string }> };
	
	let clientFolderId: string;

	if (searchData.files && searchData.files.length > 0) {
		clientFolderId = searchData.files[0].id;
		console.log('[Google] Found existing client folder:', clientFolderId);
	} else {
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
	const submissionFolderId = await createDriveFolder(serviceAccountJson, clientFolderId, folderName);

	console.log('[Google] getOrCreateSubmissionFolder - success, folderId:', submissionFolderId);
	return submissionFolderId;
}
