<script lang="ts">
	let password = $state('');
	let error = $state('');
	let isLoading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		isLoading = true;

		try {
			const response = await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			});

			const result = await response.json();

			if (result.success) {
				window.location.href = '/';
			} else {
				error = result.error || 'Invalid password';
			}
		} catch (err) {
			error = 'Something went wrong. Please try again.';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Login — Admin Dashboard</title>
</svelte:head>

<div class="login-page">
	<div class="login-card card">
		<h2>Admin Dashboard</h2>
		<p class="text-muted mb-l">Enter the admin password to continue.</p>

		<form onsubmit={handleSubmit}>
			<div class="form-group">
				<label for="password">Password</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					placeholder="Enter password"
					required
					autocomplete="current-password"
				/>
			</div>

			{#if error}
				<p class="form-error">{error}</p>
			{/if}

			<button type="submit" class="btn btn-primary btn-full" disabled={isLoading}>
				{isLoading ? 'Signing in...' : 'Sign In'}
			</button>
		</form>
	</div>
</div>

<style>
	.login-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-l);
	}

	.login-card {
		width: 100%;
		max-width: 400px;
		text-align: center;
	}

	.login-card h2 {
		margin-bottom: var(--space-s);
	}

	.login-card form {
		text-align: left;
	}

	.btn-full {
		width: 100%;
		margin-top: var(--space-m);
	}
</style>
