<!-- src/routes/diff/+page.svelte -->
<script>
	import { onDestroy } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import AlertBox from '$lib/components/AlertBox.svelte';
	import { computeDiff } from '$lib/utils/diff.js';
	import { throttle } from '$lib/utils/throttle.js';

	let original = $state('');
	let modified = $state('');
	let copyLabel = $state('Copy Diff');

	let wrapLines = $state(false);
	let trimWhitespace = $state(false);
	let ignoreCase = $state(false);

	let diff = $state({ text: '', markers: [], segments: [] });

	function prepare(text) {
		let result = text;
		if (trimWhitespace) {
			result = result
				.split('\n')
				.map((l) => l.trimEnd())
				.join('\n');
		}
		if (ignoreCase) {
			result = result.toLowerCase();
		}
		return result;
	}

	// ── Throttled diff computation ──────────────────────────────

	const throttledDiff = throttle((a, b) => {
		diff = computeDiff(a, b);
	}, 150);

	onDestroy(() => throttledDiff.cancel());

	$effect(() => {
		const a = prepare(original);
		const b = prepare(modified);
		if (!a && !b) {
			throttledDiff.cancel();
			diff = { text: '', markers: [], segments: [] };
		} else {
			throttledDiff(a, b);
		}
	});

	// ── Stats ───────────────────────────────────────────────────

	function byteSize(str) {
		return new TextEncoder().encode(str).length;
	}

	function formatSize(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	let originalBytes = $derived(original ? byteSize(original) : 0);
	let modifiedBytes = $derived(modified ? byteSize(modified) : 0);

	let sizeDelta = $derived.by(() => {
		if (!original.trim() || !modified.trim()) return null;
		const d = modifiedBytes - originalBytes;
		const pct = originalBytes > 0 ? (d / originalBytes) * 100 : 0;
		return { diff: d, pct, formatted: formatSize(Math.abs(d)) };
	});

	let diffStats = $derived.by(() => {
		if (!diff.markers || diff.markers.length === 0) return null;
		const added = diff.markers.filter((m) => m === 'added').length;
		const removed = diff.markers.filter((m) => m === 'removed').length;
		const mod = diff.markers.filter((m) => m === 'modified').length;
		const unchanged = diff.markers.filter((m) => m === null).length;
		return { added, removed, modified: mod, unchanged, total: diff.markers.length };
	});

	let hasContent = $derived(original.trim() || modified.trim());
	let hasChanges = $derived(
		diffStats && (diffStats.added > 0 || diffStats.removed > 0 || diffStats.modified > 0)
	);
	let identical = $derived(original.trim() && modified.trim() && !hasChanges);

	function loadSample() {
		original = `function greet(name) {
  console.log("Hello, " + name);
  return true;
}

const users = ["Alice", "Bob"];
users.forEach(greet);`;

		modified = `function greet(name, greeting = "Hello") {
  console.log(greeting + ", " + name + "!");
  return true;
}

const users = ["Alice", "Bob", "Charlie"];
users.forEach((user) => greet(user));`;
	}

	function swap() {
		const tmp = original;
		original = modified;
		modified = tmp;
	}

	function clear() {
		throttledDiff.cancel();
		original = '';
		modified = '';
		diff = { text: '', markers: [], segments: [] };
	}

	async function copyDiff() {
		if (!diff.text) return;
		const lines = diff.text.split('\n');
		const output = lines
			.map((line, i) => {
				const marker = diff.markers[i];
				if (marker === 'added') return '+ ' + line;
				if (marker === 'removed') return '- ' + line;
				if (marker === 'modified') return '~ ' + line;
				return '  ' + line;
			})
			.join('\n');

		try {
			await navigator.clipboard.writeText(output);
			copyLabel = 'Copied!';
			setTimeout(() => (copyLabel = 'Copy Diff'), 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}
</script>

<svelte:head>
	<title>Text Comparison - DevTools</title>
</svelte:head>

<article class="post">
	<header class="post-header">
		<h1>Text Comparison</h1>
		<span class="post-date"
			>Semantic <span class="accent-red">deletions</span> and
			<span class="accent-green">additions</span>, highlighted.</span
		>
	</header>

	<p>
		Paste two blocks of text and see what changed. Character-level highlighting on modified lines.
		Runs entirely in your browser.
	</p>

	<div class="settings-row">
		<div class="checkbox-group">
			<div class="setting-item checkbox-item">
				<input type="checkbox" id="trim-whitespace" bind:checked={trimWhitespace} />
				<label for="trim-whitespace">Trim trailing whitespace</label>
			</div>
			<div class="setting-item checkbox-item">
				<input type="checkbox" id="ignore-case" bind:checked={ignoreCase} />
				<label for="ignore-case">Ignore case</label>
			</div>
			<div class="setting-item checkbox-item">
				<input type="checkbox" id="wrap-lines" bind:checked={wrapLines} />
				<label for="wrap-lines">Wrap lines</label>
			</div>
		</div>
	</div>

	<div class="controls-wrapper">
		<div class="controls-row">
			<div class="btn-group">
				<button class="btn-secondary" onclick={swap} disabled={!hasContent} title="Swap inputs">
					<span class="swap-icon">⇄</span> Swap
				</button>
				<button class="btn-secondary" onclick={loadSample}>Sample</button>
			</div>
			<div class="controls-row right-align">
				<button class="text-btn" onclick={clear} disabled={!hasContent}>Clear All</button>
			</div>
		</div>
	</div>

	<div class="diff-inputs">
		<div class="input-group diff-pane">
			<div class="label-row">
				<label for="diff-original">Original</label>
			</div>
			<CodeEditor
				id="diff-original"
				bind:value={original}
				placeholder="Paste original text..."
				rows={10}
				wrap={wrapLines}
			/>
			{#if original.trim()}
				<div class="stats-bar">
					<span>{original.split('\n').length} lines</span>
					<span class="stats-sep">·</span>
					<span>{original.length} chars</span>
					<span class="stats-sep">·</span>
					<span>{formatSize(originalBytes)}</span>
				</div>
			{/if}
		</div>

		<div class="input-group diff-pane">
			<div class="label-row">
				<label for="diff-modified">Modified</label>
			</div>
			<CodeEditor
				id="diff-modified"
				bind:value={modified}
				placeholder="Paste modified text..."
				rows={10}
				wrap={wrapLines}
			/>
			{#if modified.trim()}
				<div class="stats-bar">
					<span>{modified.split('\n').length} lines</span>
					<span class="stats-sep">·</span>
					<span>{modified.length} chars</span>
					<span class="stats-sep">·</span>
					<span>{formatSize(modifiedBytes)}</span>
				</div>
			{/if}
		</div>
	</div>

	{#if identical}
		<AlertBox type="success">Texts are identical. No differences found.</AlertBox>
	{/if}

	{#if hasChanges}
		<div class="input-group output-group">
			<div class="label-row">
				<label>Diff Result</label>
				<button class="text-btn" onclick={copyDiff}>{copyLabel}</button>
			</div>
			<CodeEditor
				value={diff.text}
				diffMarkers={diff.markers}
				diffSegments={diff.segments}
				readonly
				rows={12}
				wrap={wrapLines}
			/>
			{#if diffStats}
				<div class="stats-bar diff-stats">
					{#if diffStats.added}
						<span class="stat-added">+{diffStats.added} added</span>
					{/if}
					{#if diffStats.removed}
						<span class="stat-removed">−{diffStats.removed} removed</span>
					{/if}
					{#if diffStats.modified}
						<span class="stat-modified">~{diffStats.modified} modified</span>
					{/if}
					<span class="stats-sep">·</span>
					<span>{diffStats.unchanged} unchanged</span>
					<span class="stats-sep">·</span>
					<span>{diffStats.total} total</span>
					{#if sizeDelta && sizeDelta.diff !== 0}
						<span class="stats-sep">·</span>
						<span
							class="size-delta"
							class:size-smaller={sizeDelta.diff < 0}
							class:size-larger={sizeDelta.diff > 0}
						>
							{sizeDelta.diff > 0 ? '+' : '−'}{sizeDelta.formatted}
							({sizeDelta.diff > 0 ? '+' : '−'}{Math.abs(sizeDelta.pct).toFixed(1)}%)
						</span>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#if !hasContent}
		<div class="calibrating-box">Paste two texts above to compare.</div>
	{/if}
</article>

<style>
	.diff-inputs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 640px) {
		.diff-inputs {
			grid-template-columns: 1fr;
		}
	}

	.diff-pane {
		margin-bottom: 0;
	}

	.diff-stats {
		opacity: 1;
		flex-wrap: wrap;
	}

	.stat-added {
		color: var(--accent-green);
	}

	.stat-removed {
		color: var(--accent-red);
	}

	.stat-modified {
		color: var(--accent-gold);
	}

	.size-delta {
		font-weight: 700;
		opacity: 1;
	}

	.size-smaller {
		color: var(--accent-green);
	}

	.size-larger {
		color: var(--accent-red);
	}

	.swap-icon {
		font-size: 1rem;
		line-height: 1;
	}
</style>
