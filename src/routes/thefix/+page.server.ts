import type { PageServerLoad } from './$types';
import formSchema from '$lib/forms/thefix.json';

export const load: PageServerLoad = async () => {
	return {
		formSchema
	};
};
