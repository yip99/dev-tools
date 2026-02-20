<!-- src/lib/components/AlertBox.svelte -->
<script>
	let { type = 'error', children } = $props();
</script>

<div class="alert-box alert-{type}">
	<span class="alert-icon">
		{#if type === 'error'}!{:else if type === 'warn'}!{:else if type === 'success'}✓{:else if type === 'info'}i{/if}
	</span>
	<span class="alert-content">{@render children()}</span>
</div>

<style>
	.alert-box {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		margin-bottom: 1rem;
		border-radius: 6px;
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}

	.alert-icon {
		font-weight: bold;
		font-size: 1.1rem;
		flex-shrink: 0;
	}

	.alert-content {
		flex: 1;
		min-width: 0;
	}

	.alert-error {
		border: 1px solid var(--accent-red);
		color: var(--accent-red);
		background: rgba(255, 77, 77, 0.05);
	}

	.alert-warn {
		border: 1px solid var(--accent-gold);
		color: var(--accent-gold);
		background: rgba(251, 191, 36, 0.05);
	}

	.alert-success {
		border: 1px solid var(--accent-green);
		color: var(--accent-green);
		background: rgba(34, 197, 94, 0.05);
	}

	.alert-info {
		border: 1px solid var(--accent-blue);
		color: var(--accent-blue);
		background: rgba(59, 130, 246, 0.05);
	}
</style>
