<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Form state
	let formData = $state<Record<string, string | File | File[]>>({});
	let filePreviews = $state<Record<string, string[]>>({});
	let isSubmitting = $state(false);
	let submitError = $state('');
	let isSuccess = $state(false);
	let successMessage = $state('');

	// AI modal state
	let showAiModal = $state(false);
	let aiModalField = $state('');
	let aiQuestion = $state('');
	let aiResponse = $state('');
	let isAiLoading = $state(false);

	// Grammar check state
	let grammarLoading = $state<Record<string, boolean>>({});
	let grammarSuggestions = $state<Record<string, string>>({});

	// Handle text input changes
	function handleInput(fieldName: string, value: string) {
		formData[fieldName] = value;
		// Clear any previous grammar suggestion
		if (grammarSuggestions[fieldName]) {
			grammarSuggestions[fieldName] = '';
		}
	}

	// Handle file input
	function handleFileChange(fieldName: string, files: FileList | null, multiple = false) {
		if (!files || files.length === 0) return;

		if (multiple) {
			const existingFiles = (formData[fieldName] as File[]) || [];
			const newFiles = [...existingFiles, ...Array.from(files)];
			formData[fieldName] = newFiles;

			// Generate previews
			const existingPreviews = filePreviews[fieldName] || [];
			const newPreviews = Array.from(files).map((file) => URL.createObjectURL(file));
			filePreviews[fieldName] = [...existingPreviews, ...newPreviews];
		} else {
			formData[fieldName] = files[0];
			filePreviews[fieldName] = [URL.createObjectURL(files[0])];
		}
	}

	// Remove file from multiple upload
	function removeFile(fieldName: string, index: number) {
		const files = formData[fieldName] as File[];
		const previews = filePreviews[fieldName];

		URL.revokeObjectURL(previews[index]);

		formData[fieldName] = files.filter((_, i) => i !== index);
		filePreviews[fieldName] = previews.filter((_, i) => i !== index);
	}

	// Grammar check
	async function checkGrammar(fieldName: string) {
		const text = formData[fieldName] as string;
		if (!text || text.trim().length < 10) return;

		grammarLoading[fieldName] = true;

		try {
			const response = await fetch('/api/grammar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text, context: data.formSchema.brandContext })
			});

			const result = await response.json();

			if (result.success && result.corrected !== text) {
				grammarSuggestions[fieldName] = result.corrected;
			}
		} catch (error) {
			console.error('Grammar check failed:', error);
		} finally {
			grammarLoading[fieldName] = false;
		}
	}

	// Accept grammar suggestion
	function acceptSuggestion(fieldName: string) {
		formData[fieldName] = grammarSuggestions[fieldName];
		grammarSuggestions[fieldName] = '';
	}

	// Reject grammar suggestion
	function rejectSuggestion(fieldName: string) {
		grammarSuggestions[fieldName] = '';
	}

	// Open AI modal
	function openAiModal(fieldName: string) {
		aiModalField = fieldName;
		aiQuestion = '';
		aiResponse = '';
		showAiModal = true;
	}

	// Ask AI
	async function askAi() {
		if (!aiQuestion.trim()) return;

		isAiLoading = true;
		aiResponse = '';

		try {
			const response = await fetch('/api/ask-ai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: formData[aiModalField] || '',
					question: aiQuestion,
					brandContext: data.formSchema.brandContext
				})
			});

			const result = await response.json();

			if (result.success) {
				aiResponse = result.response;
			} else {
				aiResponse = 'Sorry, I had trouble processing your request. Please try again.';
			}
		} catch (error) {
			aiResponse = 'Sorry, something went wrong. Please try again.';
		} finally {
			isAiLoading = false;
		}
	}

	// Close AI modal
	function closeAiModal() {
		showAiModal = false;
		aiModalField = '';
		aiQuestion = '';
		aiResponse = '';
	}

	// Handle drag and drop
	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		(e.currentTarget as HTMLElement).classList.add('dragover');
	}

	function handleDragLeave(e: DragEvent) {
		(e.currentTarget as HTMLElement).classList.remove('dragover');
	}

	function handleDrop(e: DragEvent, fieldName: string, multiple: boolean) {
		e.preventDefault();
		(e.currentTarget as HTMLElement).classList.remove('dragover');

		const files = e.dataTransfer?.files;
		if (files) {
			handleFileChange(fieldName, files, multiple);
		}
	}

	// Submit form
	async function handleSubmit(e: Event) {
		e.preventDefault();
		submitError = '';
		isSubmitting = true;

		try {
			const submitData = new FormData();

			// Add all text fields
			for (const section of data.formSchema.sections) {
				for (const field of section.fields) {
					const value = formData[field.name];

					if (field.type === 'file' && value instanceof File) {
						submitData.append(field.name, value);
					} else if (field.type === 'files' && Array.isArray(value)) {
						for (const file of value) {
							submitData.append(field.name, file);
						}
					} else if (typeof value === 'string') {
						submitData.append(field.name, value);
					}
				}
			}

			const response = await fetch('/api/submit', {
				method: 'POST',
				body: submitData
			});

			const result = await response.json();

			if (result.success) {
				successMessage = result.message;
				isSuccess = true;
			} else {
				submitError = result.error || 'Submission failed. Please try again.';
			}
		} catch (error) {
			submitError = 'Something went wrong. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}

	// Get field value
	function getFieldValue(fieldName: string): string {
		return (formData[fieldName] as string) || '';
	}
</script>

<svelte:head>
	<title>{data.formSchema.title}</title>
</svelte:head>

{#if isSuccess}
	<!-- Success Screen -->
	<div class="success-screen">
		<div class="success-icon">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
				<path
					fill-rule="evenodd"
					d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z"
					clip-rule="evenodd"
				/>
			</svg>
		</div>
		<h2>You're all set!</h2>
		<p class="success-message">{successMessage}</p>
		<p class="success-note">
			Made a mistake? No worries, just submit another form and we'll use the latest one.
		</p>
	</div>
{:else}
	<!-- Form -->
	<div class="form-page">
		<header class="form-header">
			<div class="container">
				<h1>{data.formSchema.title}</h1>
				<p class="form-description">{data.formSchema.description}</p>
			</div>
		</header>

		<main class="container">
			<form onsubmit={handleSubmit}>
				{#each data.formSchema.sections as section}
					<section class="form-section">
						<h3 class="form-section-title">{section.title}</h3>

						{#each section.fields as field}
							<div class="form-group">
								<label for={field.name}>
									{field.label}
									{#if !field.required}
										<span class="label-optional">(optional)</span>
									{/if}
								</label>

								{#if field.type === 'text' || field.type === 'email' || field.type === 'number'}
									<input
										type={field.type}
										id={field.name}
										name={field.name}
										placeholder={field.placeholder || ''}
										required={field.required}
										value={getFieldValue(field.name)}
										oninput={(e) => handleInput(field.name, e.currentTarget.value)}
									/>
								{:else if field.type === 'textarea'}
									<textarea
										id={field.name}
										name={field.name}
										placeholder={field.placeholder || ''}
										required={field.required}
										value={getFieldValue(field.name)}
										oninput={(e) => handleInput(field.name, e.currentTarget.value)}
									></textarea>

									{#if field.ai}
										<div class="ai-buttons">
											<button
												type="button"
												class="btn btn-ai"
												onclick={() => checkGrammar(field.name)}
												disabled={grammarLoading[field.name] ||
													!getFieldValue(field.name) ||
													getFieldValue(field.name).length < 10}
											>
												{grammarLoading[field.name] ? 'Checking...' : 'Grammar Check'}
											</button>
											<button
												type="button"
												class="btn btn-ai"
												onclick={() => openAiModal(field.name)}
											>
												Ask AI
											</button>
										</div>

										{#if grammarSuggestions[field.name]}
											<div class="grammar-suggestion">
												<p class="suggestion-label">Suggested correction:</p>
												<p class="suggestion-text">{grammarSuggestions[field.name]}</p>
												<div class="suggestion-actions">
													<button
														type="button"
														class="btn btn-small btn-primary"
														onclick={() => acceptSuggestion(field.name)}
													>
														Accept
													</button>
													<button
														type="button"
														class="btn btn-small btn-secondary"
														onclick={() => rejectSuggestion(field.name)}
													>
														Keep Original
													</button>
												</div>
											</div>
										{/if}
									{/if}
								{:else if field.type === 'file'}
									<div
										class="upload-zone"
										role="button"
										tabindex="0"
										ondragover={handleDragOver}
										ondragleave={handleDragLeave}
										ondrop={(e) => handleDrop(e, field.name, false)}
										onclick={() => document.getElementById(`file-${field.name}`)?.click()}
										onkeypress={(e) => {
											if (e.key === 'Enter')
												document.getElementById(`file-${field.name}`)?.click();
										}}
									>
										<input
											type="file"
											id={`file-${field.name}`}
											accept={field.accept || 'image/*'}
											class="sr-only"
											onchange={(e) => handleFileChange(field.name, e.currentTarget.files, false)}
										/>
										<div class="upload-zone-icon">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="1.5"
													d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
												/>
											</svg>
										</div>
										<p class="upload-zone-text">
											<strong>Click to upload</strong> or drag and drop
										</p>
									</div>

									{#if filePreviews[field.name]?.length}
										<div class="preview-images">
											{#each filePreviews[field.name] as preview}
												<div class="preview-image">
													<img src={preview} alt="Preview" />
												</div>
											{/each}
										</div>
									{/if}
								{:else if field.type === 'files'}
									<div
										class="upload-zone"
										role="button"
										tabindex="0"
										ondragover={handleDragOver}
										ondragleave={handleDragLeave}
										ondrop={(e) => handleDrop(e, field.name, true)}
										onclick={() => document.getElementById(`file-${field.name}`)?.click()}
										onkeypress={(e) => {
											if (e.key === 'Enter')
												document.getElementById(`file-${field.name}`)?.click();
										}}
									>
										<input
											type="file"
											id={`file-${field.name}`}
											accept={field.accept || 'image/*'}
											multiple
											class="sr-only"
											onchange={(e) => handleFileChange(field.name, e.currentTarget.files, true)}
										/>
										<div class="upload-zone-icon">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="1.5"
													d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
												/>
											</svg>
										</div>
										<p class="upload-zone-text">
											<strong>Click to upload</strong> or drag and drop multiple files
										</p>
									</div>

									{#if filePreviews[field.name]?.length}
										<div class="preview-images">
											{#each filePreviews[field.name] as preview, i}
												<div class="preview-image">
													<img src={preview} alt="Preview {i + 1}" />
													<button
														type="button"
														class="preview-image-remove"
														onclick={() => removeFile(field.name, i)}
													>
														×
													</button>
												</div>
											{/each}
										</div>
									{/if}
								{/if}

								{#if field.hint}
									<p class="form-hint">{field.hint}</p>
								{/if}
							</div>
						{/each}
					</section>
				{/each}

				{#if submitError}
					<div class="form-error-banner">
						{submitError}
					</div>
				{/if}

				<div class="form-actions">
					<button type="submit" class="btn btn-large" disabled={isSubmitting}>
						{isSubmitting ? 'Submitting...' : 'Submit'}
					</button>
				</div>
			</form>
		</main>
	</div>
{/if}

<!-- AI Side Panel -->
{#if showAiModal}
	<div class="ai-panel-overlay" role="button" tabindex="-1" onclick={closeAiModal} onkeydown={(e) => e.key === 'Escape' && closeAiModal()}></div>
	<div class="ai-panel" role="dialog" aria-modal="true">
		<div class="ai-panel-header">
			<h4>Ask AI</h4>
			<button type="button" class="btn-close" onclick={closeAiModal}>×</button>
		</div>
		<div class="ai-panel-body">
			<div class="ai-presets">
				<button type="button" class="btn btn-small" onclick={() => { aiQuestion = 'Give me an example'; askAi(); }}>Example</button>
				<button type="button" class="btn btn-small" onclick={() => { aiQuestion = 'Make it more professional'; askAi(); }}>More Professional</button>
				<button type="button" class="btn btn-small" onclick={() => { aiQuestion = 'Make it more friendly'; askAi(); }}>More Friendly</button>
				<button type="button" class="btn btn-small" onclick={() => { aiQuestion = 'Make it shorter'; askAi(); }}>Shorter</button>
			</div>

			<div class="form-group">
				<label for="ai-question">Or ask your own</label>
				<input
					type="text"
					id="ai-question"
					placeholder="Is this too long?"
					bind:value={aiQuestion}
					onkeypress={(e) => {
						if (e.key === 'Enter') askAi();
					}}
				/>
			</div>

			{#if aiResponse}
				<div class="ai-response">
					<p>{aiResponse}</p>
				</div>
			{/if}
		</div>
		<div class="ai-panel-footer">
			<button type="button" class="btn" onclick={closeAiModal}>Close</button>
			<button
				type="button"
				class="btn"
				onclick={askAi}
				disabled={isAiLoading || !aiQuestion.trim()}
			>
				{isAiLoading ? '...' : 'Ask'}
			</button>
		</div>
	</div>
{/if}

<style>
	.btn-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--orange);
		opacity: 0.6;
		padding: 0;
		line-height: 1;
	}

	.btn-close:hover {
		opacity: 1;
	}

	.grammar-suggestion {
		margin-top: 16px;
		padding: 16px;
		background-color: rgba(254, 62, 26, 0.05);
		border-left: 3px solid var(--orange);
	}

	.suggestion-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--orange);
		margin-bottom: 8px;
	}

	.suggestion-text {
		font-size: 0.875rem;
		margin-bottom: 16px;
	}

	.suggestion-actions {
		display: flex;
		gap: 8px;
	}

	.ai-response {
		margin-top: 16px;
		padding: 12px;
		border: 1px solid var(--orange);
	}

	.form-error-banner {
		border: 1px solid var(--orange);
		padding: 16px;
		margin-bottom: 24px;
		text-align: center;
	}

	.form-actions {
		padding-top: 48px;
		text-align: center;
	}

	.btn-large {
		padding: 16px 48px;
		font-size: 1rem;
	}

	.upload-zone-icon svg {
		width: 48px;
		height: 48px;
	}
</style>
