<script lang="ts">
	import { onMount } from 'svelte';

	interface Submission {
		rowIndex: number;
		timestamp: string;
		name: string;
		email: string;
		phoneExtension: string;
		role: string;
		department: string;
		yearsExperience: string;
		specialty: string;
		credentials: string;
		favoriteService: string;
		personalQuote: string;
		bioShort: string;
		bioFull: string;
		profilePhotoUrl: string;
		additionalImagesUrls: string;
		anythingElse: string;
		extraImagesUrls: string;
		status: string;
	}

	let submissions = $state<Submission[]>([]);
	let isLoading = $state(true);
	let error = $state('');
	let selectedSubmission = $state<Submission | null>(null);
	let statusFilter = $state('');
	let updatingStatus = $state<Record<number, boolean>>({});

	// Stats
	let stats = $derived({
		total: submissions.length,
		new: submissions.filter((s) => s.status === 'New').length,
		reviewed: submissions.filter((s) => s.status === 'Reviewed').length,
		added: submissions.filter((s) => s.status === 'Added').length
	});

	onMount(async () => {
		await loadSubmissions();
	});

	async function loadSubmissions() {
		isLoading = true;
		error = '';

		try {
			const url = statusFilter ? `/api/submissions?status=${statusFilter}` : '/api/submissions';
			const response = await fetch(url);
			const result = await response.json();

			if (result.success) {
				submissions = result.submissions;
			} else {
				error = result.error || 'Failed to load submissions';
			}
		} catch (err) {
			error = 'Failed to load submissions';
		} finally {
			isLoading = false;
		}
	}

	async function updateStatus(rowIndex: number, newStatus: string) {
		updatingStatus[rowIndex] = true;

		try {
			const response = await fetch('/api/submissions', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rowIndex, status: newStatus })
			});

			const result = await response.json();

			if (result.success) {
				// Update local state
				const submission = submissions.find((s) => s.rowIndex === rowIndex);
				if (submission) {
					submission.status = newStatus;
				}
				if (selectedSubmission?.rowIndex === rowIndex) {
					selectedSubmission.status = newStatus;
				}
			}
		} catch (err) {
			console.error('Failed to update status:', err);
		} finally {
			updatingStatus[rowIndex] = false;
		}
	}

	function formatDate(timestamp: string): string {
		if (!timestamp) return '';
		return new Date(timestamp).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function copyForWebflow(submission: Submission) {
		const text = `Name: ${submission.name}
Email: ${submission.email}
Role: ${submission.role}
Department: ${submission.department}
Years of Experience: ${submission.yearsExperience}
Specialty: ${submission.specialty}
Credentials: ${submission.credentials}
Favorite Service: ${submission.favoriteService}
Personal Quote: ${submission.personalQuote}
Bio (Short): ${submission.bioShort}
Bio (Full): ${submission.bioFull}
Profile Photo: ${submission.profilePhotoUrl}
Additional Images: ${submission.additionalImagesUrls}
Anything Else: ${submission.anythingElse}
Extra Images: ${submission.extraImagesUrls}`;

		navigator.clipboard.writeText(text);
		alert('Copied to clipboard!');
	}
</script>

<svelte:head>
	<title>Admin Dashboard — The Fix Portal</title>
</svelte:head>

<div class="dashboard">
	<header class="dashboard-header">
		<div class="container container-wide">
			<h1>Admin Dashboard</h1>
		</div>
	</header>

	<main class="container container-wide">
		<!-- Client Routes -->
		<div class="client-routes">
			<h3>Client Forms</h3>
			<div class="client-routes-list">
				<a href="/thefix" class="btn btn-small">The Fix Team Portal</a>
			</div>
		</div>

		<!-- Stats -->
		<div class="dashboard-stats">
			<div class="stat-card">
				<div class="stat-value">{stats.total}</div>
				<div class="stat-label">Total Submissions</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.new}</div>
				<div class="stat-label">New</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.reviewed}</div>
				<div class="stat-label">Reviewed</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.added}</div>
				<div class="stat-label">Added to Webflow</div>
			</div>
		</div>

		<!-- Filters -->
		<div class="filters mb-l">
			<select bind:value={statusFilter} onchange={() => loadSubmissions()}>
				<option value="">All Submissions</option>
				<option value="New">New</option>
				<option value="Reviewed">Reviewed</option>
				<option value="Added">Added to Webflow</option>
			</select>
		</div>

		<!-- Table -->
		{#if isLoading}
			<div class="text-center">
				<span class="loading"></span>
				<p>Loading submissions...</p>
			</div>
		{:else if error}
			<div class="form-error-banner">{error}</div>
		{:else if submissions.length === 0}
			<div class="text-center text-muted">
				<p>No submissions yet.</p>
			</div>
		{:else}
			<div class="table-container">
				<table>
					<thead>
						<tr>
							<th>Date</th>
							<th>Name</th>
							<th>Email</th>
							<th>Role</th>
							<th>Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each submissions as submission}
							<tr
								onclick={() => (selectedSubmission = submission)}
								class:selected={selectedSubmission?.rowIndex === submission.rowIndex}
							>
								<td>{formatDate(submission.timestamp)}</td>
								<td><strong>{submission.name}</strong></td>
								<td>{submission.email}</td>
								<td>{submission.role || '—'}</td>
								<td>
									<span class="status-badge status-{submission.status.toLowerCase()}">
										{submission.status}
									</span>
								</td>
								<td>
									<button
										class="btn btn-small btn-secondary"
										onclick={(e) => {
											e.stopPropagation();
											selectedSubmission = submission;
										}}
									>
										View
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</main>
</div>

<!-- Detail Modal -->
{#if selectedSubmission}
	<div
		class="modal-overlay"
		onclick={() => (selectedSubmission = null)}
		role="dialog"
		aria-modal="true"
	>
		<div class="modal modal-large" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h4>{selectedSubmission.name}</h4>
				<button class="btn-close" onclick={() => (selectedSubmission = null)}>×</button>
			</div>
			<div class="modal-body">
				<div class="detail-grid">
					<div class="detail-section">
						<h5>Basic Info</h5>
						<dl>
							<dt>Email</dt>
							<dd>{selectedSubmission.email}</dd>
							<dt>Phone Extension</dt>
							<dd>{selectedSubmission.phoneExtension || '—'}</dd>
							<dt>Role</dt>
							<dd>{selectedSubmission.role || '—'}</dd>
							<dt>Department</dt>
							<dd>{selectedSubmission.department || '—'}</dd>
							<dt>Years of Experience</dt>
							<dd>{selectedSubmission.yearsExperience || '—'}</dd>
						</dl>
					</div>

					<div class="detail-section">
						<h5>About</h5>
						<dl>
							<dt>Specialty</dt>
							<dd>{selectedSubmission.specialty || '—'}</dd>
							<dt>Credentials</dt>
							<dd>{selectedSubmission.credentials || '—'}</dd>
							<dt>Favorite Service</dt>
							<dd>{selectedSubmission.favoriteService || '—'}</dd>
							<dt>Personal Quote</dt>
							<dd>{selectedSubmission.personalQuote || '—'}</dd>
						</dl>
					</div>

					<div class="detail-section full-width">
						<h5>Bio</h5>
						<dl>
							<dt>Short Bio</dt>
							<dd>{selectedSubmission.bioShort || '—'}</dd>
							<dt>Full Bio</dt>
							<dd class="bio-text">{selectedSubmission.bioFull || '—'}</dd>
						</dl>
					</div>

					<div class="detail-section full-width">
						<h5>Photos</h5>
						{#if selectedSubmission.profilePhotoUrl}
							<div class="photo-grid">
								<a href={selectedSubmission.profilePhotoUrl} target="_blank" rel="noopener">
									<img src={selectedSubmission.profilePhotoUrl} alt="Profile" class="detail-image" />
								</a>
							</div>
						{/if}
						{#if selectedSubmission.additionalImagesUrls}
							<p class="text-muted mt-m">Additional: {selectedSubmission.additionalImagesUrls}</p>
						{/if}
					</div>

					{#if selectedSubmission.anythingElse}
						<div class="detail-section full-width">
							<h5>Anything Else</h5>
							<p>{selectedSubmission.anythingElse}</p>
						</div>
					{/if}

					<div class="detail-section full-width">
						<h5>Status</h5>
						<select
							value={selectedSubmission.status}
							onchange={(e) =>
								updateStatus(selectedSubmission!.rowIndex, e.currentTarget.value)}
							disabled={updatingStatus[selectedSubmission.rowIndex]}
						>
							<option value="New">New</option>
							<option value="Reviewed">Reviewed</option>
							<option value="Added">Added to Webflow</option>
						</select>
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<button
					class="btn btn-secondary"
					onclick={() => copyForWebflow(selectedSubmission!)}
				>
					Copy for Webflow
				</button>
				<button class="btn btn-primary" onclick={() => (selectedSubmission = null)}>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.dashboard {
		min-height: 100vh;
	}

	.filters select {
		padding: var(--space-s) var(--space-m);
		border-radius: var(--radius-m);
		border: 1px solid var(--color-border);
		background-color: var(--color-white);
		font-size: 0.875rem;
	}

	.modal-large {
		max-width: 800px;
		max-height: 90vh;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-l);
	}

	.detail-section {
		padding: var(--space-m);
		background-color: var(--color-background);
		border-radius: var(--radius-m);
	}

	.detail-section.full-width {
		grid-column: 1 / -1;
	}

	.detail-section h5 {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--color-primary);
		margin-bottom: var(--space-m);
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-s) var(--space-m);
		font-size: 0.875rem;
	}

	dt {
		color: var(--color-text-muted);
		font-weight: 500;
	}

	dd {
		margin: 0;
	}

	.bio-text {
		white-space: pre-wrap;
	}

	.photo-grid {
		display: flex;
		gap: var(--space-m);
	}

	.detail-image {
		width: 150px;
		height: 150px;
		object-fit: cover;
		border-radius: var(--radius-m);
	}

	tr.selected {
		background-color: rgba(254, 62, 26, 0.05);
	}

	.btn-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--color-text-muted);
		padding: 0;
		line-height: 1;
	}

	.form-error-banner {
		background-color: rgba(239, 68, 68, 0.1);
		border: 1px solid var(--color-error);
		color: var(--color-error);
		padding: var(--space-m);
		border-radius: var(--radius-m);
		text-align: center;
	}

	@media (max-width: 768px) {
		.detail-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
