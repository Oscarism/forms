/**
 * Claude Haiku API Wrapper
 * Provides grammar checking, Q&A, and personalized message generation
 */

import Anthropic from '@anthropic-ai/sdk';

const THE_FIX_BRAND_CONTEXT = `
The Fix Aesthetics + Wellness is a medical aesthetics and wellness center with two locations in El Paso, Texas (East and West). We provide professional aesthetic treatments, wellness services, and personalized care in an approachable, welcoming environment.

BRAND POSITIONING:
The Fix occupies a unique position: we offer high-quality, professional aesthetic treatments without the intimidation factor of high-end luxury medical spas. We're approachable experts. Credentialed professionals who make you feel comfortable, seen, and guided through your aesthetic journey. We're not transactional—we're building long-term relationships based on trust, personalized care, and real results. We're elevated but not exclusive. Professional but not pretentious. Expert but not intimidating.

CORE VALUES:
- Trusted expertise: Credentialed medical professionals, proven FDA-approved technologies, transparent about what works
- Personalized care: No cookie-cutter treatments, customized to each person
- Approachable environment: Warm, welcoming, explains in plain language, never talks down
- People-first philosophy: Caring humans who love what they do, relationships matter
- Transparency: Upfront about pricing, realistic about results, no hidden fees

BRAND PERSONALITY:
If The Fix were a person, they would be a trusted friend who's also a credentialed expert. Warm and welcoming but knows their stuff. Honest and straightforward, never pushy. Confident without being arrogant. Genuinely excited to help you feel your best.

TONE OF VOICE:
- Conversational and friendly, not clinical
- Knowledgeable but accessible (no unnecessary jargon)
- Warm and encouraging, never judgmental
- Confident and reassuring
- Honest and transparent
- Personable—we speak like real people, not a corporate entity

SERVICES: Injectables (Botox, Dysport, fillers, Sculptra, Kybella), Thread lifts, Skin rejuvenation (Microneedling, HydraFacial, peels), Energy treatments (Morpheus8, FaceTite), Laser treatments, Intimate wellness, IV therapy, Body contouring.
`;

/**
 * Create Anthropic client
 */
function createClient(apiKey: string): Anthropic {
	return new Anthropic({ apiKey });
}

/**
 * Grammar check - fixes spelling and grammar while preserving meaning
 */
export async function grammarCheck(
	apiKey: string,
	text: string,
	additionalContext?: string
): Promise<string> {
	const client = createClient(apiKey);

	const response = await client.messages.create({
		model: 'claude-haiku-4-5-20251001',
		max_tokens: 1024,
		messages: [
			{
				role: 'user',
				content: `You are a helpful editor. Fix any spelling and grammar errors in the following text while preserving the author's voice and meaning. Only return the corrected text with no explanation or commentary.

${additionalContext ? `Context: ${additionalContext}\n\n` : ''}Text to correct:
${text}`
			}
		]
	});

	const textBlock = response.content.find((block) => block.type === 'text');
	return textBlock ? textBlock.text : text;
}

/**
 * Ask AI - answers questions about writing with brand context
 */
export async function askAI(
	apiKey: string,
	text: string,
	question: string,
	brandContext?: string
): Promise<string> {
	const client = createClient(apiKey);

	const context = brandContext || THE_FIX_BRAND_CONTEXT;

	const response = await client.messages.create({
		model: 'claude-haiku-4-5-20251001',
		max_tokens: 256,
		messages: [
			{
				role: 'user',
				content: `You help team members write their profile bios. Be EXTREMELY CONCISE - max 2-3 sentences.

Brand tone: warm, friendly, approachable, professional but not pretentious.

Their text: "${text || '(empty)'}"
Question: ${question}

Give a brief, actionable answer. No fluff, no lengthy explanations. Just the helpful point.`
			}
		]
	});

	const textBlock = response.content.find((block) => block.type === 'text');
	return textBlock ? textBlock.text : 'Sorry, I could not process your request.';
}

/**
 * Generate personalized thank you message after form submission
 */
export async function generateThankYou(
	apiKey: string,
	name: string,
	role?: string
): Promise<string> {
	const client = createClient(apiKey);

	const response = await client.messages.create({
		model: 'claude-haiku-4-5-20251001',
		max_tokens: 256,
		messages: [
			{
				role: 'user',
				content: `Generate a warm, personalized thank you message for a team member who just submitted their profile information for The Fix Aesthetics + Wellness website.

Their name is: ${name}
${role ? `Their role is: ${role}` : ''}

The message should:
- Be warm and appreciative
- Feel personal (use their name)
- Be 2-3 sentences max
- Match The Fix's friendly, encouraging brand voice
- NOT include any subject line or greeting - just the message itself

Return only the thank you message, nothing else.`
			}
		]
	});

	const textBlock = response.content.find((block) => block.type === 'text');
	return (
		textBlock?.text ||
		`Thank you so much, ${name}! We really appreciate you taking the time to share your information with us.`
	);
}
