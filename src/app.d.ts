// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// Cloudflare Pages environment variables
interface CloudflareEnv {
	ADMIN_PASSWORD: string;
	ANTHROPIC_API_KEY: string;
	GOOGLE_SERVICE_ACCOUNT_JSON: string;
	GOOGLE_SHEET_ID: string;
	GOOGLE_DRIVE_FOLDER_ID: string;
}

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: CloudflareEnv;
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
