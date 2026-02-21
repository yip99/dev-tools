<!-- src/routes/formatter/+page.svelte -->
<script>
	import { untrack } from 'svelte';
	import AlertBox from '$lib/components/AlertBox.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { computeDiff } from '$lib/utils/diff.js';
	import { detectLanguage } from '$lib/utils/highlight.js';
	import { formatCode, minifyCode, parseJSON, stripNulls, sortKeys } from '$lib/utils/format.js';

	let input = $state('');
	let output = $state('');
	let error = $state(null);
	let copyLabel = $state('Copy');
	let formatting = $state(false);

	let indentSize = $state(2);
	let indentChar = $state('space');
	let autoFormat = $state(true);
	let removeNulls = $state(false);
	let spaceAfterColon = $state(false);
	let wrapLines = $state(false);
	let languageChoice = $state('auto');

	let lastMode = $state('format');
	let resultView = $state('formatted');

	let indentValue = $derived((indentChar === 'tab' ? '\t' : ' ').repeat(indentSize));
	let detectedLanguage = $derived(detectLanguage(input));
	let language = $derived(languageChoice === 'auto' ? detectedLanguage : languageChoice);
	let isJSON = $derived(language === 'json');
	let canFormat = $derived(['json', 'javascript', 'html', 'css'].includes(language));
	let diff = $derived(computeDiff(input, output));

	$effect(() => {
		if (!autoFormat) return;
		if (input.trim()) {
			untrack(() => applyMode());
		} else {
			output = '';
			error = null;
		}
	});

	$effect(() => {
		void indentValue;
		void removeNulls;
		void spaceAfterColon;
		void languageChoice;
		untrack(() => {
			if (input.trim()) applyMode();
		});
	});

	// ── JSON-specific formatting ────────────────────────────────

	function jsonStringify(data, indent = null) {
		let result = JSON.stringify(data, null, indent);
		if (!spaceAfterColon && indent) {
			result = result.replace(/(^\s*"(?:[^"\\]|\\.)*"): /gm, '$1:');
		}
		return result;
	}

	function processJSON(transformFn) {
		if (!input.trim()) return;
		try {
			let parsed = parseJSON(input);
			if (removeNulls) parsed = stripNulls(parsed);
			output = transformFn(parsed);
			error = null;
		} catch (e) {
			error = 'Invalid JSON: ' + e.message;
			output = '';
		}
	}

	// ── Mode application ────────────────────────────────────────

	async function applyMode() {
		if (!input.trim()) return;

		// JSON with special options — use local stringify
		if (isJSON && (lastMode === 'sort' || !spaceAfterColon || removeNulls)) {
			if (lastMode === 'minify') {
				processJSON((d) => JSON.stringify(d));
			} else if (lastMode === 'sort') {
				processJSON((d) => jsonStringify(sortKeys(d), indentValue));
			} else {
				processJSON((d) => jsonStringify(d, indentValue));
			}
			return;
		}

		// Minify (sync)
		if (lastMode === 'minify') {
			try {
				if (isJSON) {
					output = minifyCode(JSON.stringify(parseJSON(input)), 'json');
				} else {
					output = minifyCode(input, language);
				}
				error = null;
			} catch (e) {
				error = `Minify error: ${e.message}`;
				output = '';
			}
			return;
		}

		// Format via Prettier (async)
		if (canFormat) {
			formatting = true;
			try {
				const src = isJSON ? JSON.stringify(parseJSON(input)) : input;
				output = await formatCode(src, language, {
					indent: indentValue,
					indentSize
				});
				error = null;
			} catch (e) {
				error = `Format error: ${e.message}`;
				output = '';
			} finally {
				formatting = false;
			}
			return;
		}

		output = input;
		error = null;
	}

	function doFormat() {
		lastMode = 'format';
		applyMode();
	}

	function doMinify() {
		lastMode = 'minify';
		applyMode();
	}

	function doSort() {
		lastMode = 'sort';
		applyMode();
	}

	function escapeJSON() {
		if (!input.trim()) return;
		output = JSON.stringify(input);
		error = null;
	}

	function unescapeJSON() {
		if (!input.trim()) return;
		try {
			const parsed = JSON.parse(input);
			output = typeof parsed === 'string' ? parsed : jsonStringify(parsed, indentValue);
			error = null;
		} catch (e) {
			error = 'Could not unescape: ' + e.message;
			output = '';
		}
	}

	// ── UI utilities ────────────────────────────────────────────

	function clear() {
		input = '';
		output = '';
		error = null;
	}

	async function copyToClipboard() {
		if (!output) return;
		try {
			await navigator.clipboard.writeText(output);
			copyLabel = 'Copied!';
			setTimeout(() => (copyLabel = 'Copy'), 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	const SAMPLES = {
		json: '{ id: 1, name: "DevTool User", active: true, score: 42.5, empty: null, tags: ["admin", "dev"], list: [1, 2, ], }',
		javascript:
			'// User service\nconst getUser=async(id)=>{const res=await fetch(`/api/users/${id}`);if(!res.ok){throw new Error("Not found")}const data=await res.json();return{id:data.id,name:data.name,active:true,tags:["admin","dev"]}};',
		html: '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Hello</title><link rel="stylesheet" href="style.css"></head><body><div class="container"><h1>Hello World</h1><p>This is a <strong>test</strong> paragraph.</p><ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul></div><script src="app.js"><\/script></body></html>',
		css: ':root{--bg:#111;--fg:#eee;--accent:#fbbf24}.container{max-width:680px;margin:0 auto;padding:2rem 1.5rem;display:flex;flex-direction:column}.container h1{font-size:1.8rem;color:var(--fg);margin-bottom:.5rem}@media(max-width:640px){.container{padding:1rem}.container h1{font-size:1.4rem}}'
	};

	function loadSample() {
		if (languageChoice === 'auto') languageChoice = 'json';
		input = SAMPLES[language] || SAMPLES.json;
		if (!autoFormat) applyMode();
	}

	// ── Stats ───────────────────────────────────────────────────

	function countKeys(obj) {
		if (typeof obj !== 'object' || obj === null) return 0;
		if (Array.isArray(obj)) return obj.reduce((sum, item) => sum + countKeys(item), 0);
		return Object.keys(obj).length + Object.values(obj).reduce((sum, v) => sum + countKeys(v), 0);
	}

	function byteSize(str) {
		return new TextEncoder().encode(str).length;
	}

	function formatSize(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function languageLabel(lang) {
		if (!lang) return 'Code';
		const labels = { json: 'JSON', javascript: 'JS', html: 'HTML', css: 'CSS' };
		return labels[lang] || lang.toUpperCase();
	}

	let inputStats = $derived.by(() => {
		const text = input || '';
		if (!text.trim()) return null;
		const lines = text.split('\n').length;
		const size = formatSize(byteSize(text));
		let keys = null;
		if (isJSON) {
			try {
				keys = countKeys(parseJSON(text));
			} catch {}
		}
		return { lines, keys, size };
	});

	let outputStats = $derived.by(() => {
		const text = output || '';
		if (!text.trim()) return null;
		const lines = text.split('\n').length;
		const size = formatSize(byteSize(text));
		let keys = null;
		if (isJSON) {
			try {
				keys = countKeys(JSON.parse(text));
			} catch {}
		}
		return { lines, keys, size };
	});

	let diffStats = $derived.by(() => {
		if (!diff.markers || diff.markers.length === 0) return null;
		const added = diff.markers.filter((m) => m === 'added').length;
		const removed = diff.markers.filter((m) => m === 'removed').length;
		const modified = diff.markers.filter((m) => m === 'modified').length;
		const unchanged = diff.markers.filter((m) => m === null).length;
		return { added, removed, modified, unchanged, total: diff.markers.length };
	});
</script>

<svelte:head>
	<title>{languageLabel(language)} Formatter - DevTools</title>
</svelte:head>

<article class="post">
	<header class="post-header">
		<h1>Code Formatter</h1>
		<span class="post-date"
			>Format, validate, and transform. <span class="accent-gold">Syntax highlighted.</span></span
		>
	</header>

	<p>
		{#if isJSON}
			Format JSON with smart-fix for missing quotes and trailing commas.
		{:else if language === 'javascript'}
			Format JavaScript with Prettier. Re-indents and cleans up code.
		{:else if language === 'html'}
			Format HTML with Prettier. Cleans up tags and indentation.
		{:else if language === 'css'}
			Format CSS with Prettier. Organizes rules and indentation.
		{:else}
			Paste code to format with syntax highlighting. Auto-detects JSON, JavaScript, HTML, and CSS.
		{/if}
	</p>

	<div class="settings-row">
		<div class="setting-item">
			<label for="language-select">Language</label>
			<select id="language-select" bind:value={languageChoice}>
				<option value="auto"
					>Auto{detectedLanguage ? ` (${languageLabel(detectedLanguage)})` : ''}</option
				>
				<option value="json">JSON</option>
				<option value="javascript">JavaScript</option>
				<option value="html">HTML</option>
				<option value="css">CSS</option>
			</select>
		</div>

		<div class="setting-item">
			<label for="indent-char">Character</label>
			<select id="indent-char" bind:value={indentChar}>
				<option value="space">Spaces</option>
				<option value="tab">Tabs</option>
			</select>
		</div>

		<div class="setting-item">
			<label for="indent-size">Size</label>
			<select id="indent-size" bind:value={indentSize}>
				<option value={1}>1</option>
				<option value={2}>2</option>
				<option value={3}>3</option>
				<option value={4}>4</option>
			</select>
		</div>

		<div class="checkbox-group">
			<div class="setting-item checkbox-item">
				<input type="checkbox" id="auto-format" bind:checked={autoFormat} />
				<label for="auto-format">Auto-format</label>
			</div>
			{#if isJSON}
				<div class="setting-item checkbox-item">
					<input type="checkbox" id="remove-nulls" bind:checked={removeNulls} />
					<label for="remove-nulls">Remove nulls</label>
				</div>
				<div class="setting-item checkbox-item">
					<input type="checkbox" id="space-after-colon" bind:checked={spaceAfterColon} />
					<label for="space-after-colon">Space after colon</label>
				</div>
			{/if}
			<div class="setting-item checkbox-item">
				<input type="checkbox" id="wrap-lines" bind:checked={wrapLines} />
				<label for="wrap-lines">Wrap lines</label>
			</div>
		</div>
	</div>

	<div class="input-group">
		<div class="label-row">
			<label for="code-input">Input</label>
			<button class="text-btn" onclick={loadSample}>Load Sample</button>
		</div>
		<CodeEditor
			id="code-input"
			bind:value={input}
			placeholder="Paste code here..."
			rows={8}
			wrap={wrapLines}
			{language}
		/>
		{#if inputStats}
			<div class="stats-bar">
				<span>{inputStats.lines} lines</span>
				{#if inputStats.keys !== null}
					<span class="stats-sep">·</span>
					<span>{inputStats.keys} keys</span>
				{/if}
				<span class="stats-sep">·</span>
				<span>{inputStats.size}</span>
			</div>
		{/if}
	</div>

	<div class="controls-wrapper">
		<div class="controls-row">
			<div class="btn-group">
				<button
					class="btn-primary"
					class:btn-active={lastMode === 'format'}
					onclick={doFormat}
					disabled={!input || !canFormat || formatting}
				>
					{formatting ? 'Formatting…' : 'Format'}
				</button>
				<button
					class="btn-primary"
					class:btn-active={lastMode === 'minify'}
					onclick={doMinify}
					disabled={!input || !canFormat || formatting}>Minify</button
				>
				{#if isJSON}
					<button
						class="btn-primary"
						class:btn-active={lastMode === 'sort'}
						onclick={doSort}
						disabled={!input || formatting}>Sort</button
					>
				{/if}
			</div>
			{#if isJSON}
				<div class="btn-group">
					<button class="btn-secondary" onclick={escapeJSON} disabled={!input}>Escape</button>
					<button class="btn-secondary" onclick={unescapeJSON} disabled={!input}>Unescape</button>
				</div>
			{/if}
			<div class="right-align">
				<button class="text-btn" onclick={clear} disabled={!input && !output}>Clear All</button>
			</div>
		</div>
	</div>

	{#if error}
		<AlertBox type="error">{error}</AlertBox>
	{/if}

	<div class="input-group output-group">
		<div class="label-row">
			<div class="view-tabs">
				<button
					class="view-tab"
					class:view-tab-active={resultView === 'formatted'}
					onclick={() => (resultView = 'formatted')}
				>
					Result
				</button>
				<button
					class="view-tab"
					class:view-tab-active={resultView === 'diff'}
					onclick={() => (resultView = 'diff')}
				>
					Diff
					{#if diffStats && (diffStats.added || diffStats.removed || diffStats.modified)}
						<span class="diff-badge"
							>{diffStats.added + diffStats.removed + diffStats.modified}</span
						>
					{/if}
				</button>
			</div>
			{#if output && resultView === 'formatted'}
				<button class="text-btn" onclick={copyToClipboard}>{copyLabel}</button>
			{/if}
		</div>

		{#if resultView === 'formatted'}
			<CodeEditor
				id="code-output"
				value={output}
				readonly
				placeholder="Result will appear here..."
				rows={8}
				error={!!error}
				wrap={wrapLines}
				{language}
			/>
		{:else}
			<CodeEditor
				value={diff.text}
				diffMarkers={diff.markers}
				diffSegments={diff.segments}
				readonly
				rows={8}
				wrap={wrapLines}
			/>
		{/if}

		{#if outputStats}
			<div class="stats-bar">
				<span>{outputStats.lines} lines</span>
				{#if outputStats.keys !== null}
					<span class="stats-sep">·</span>
					<span>{outputStats.keys} keys</span>
				{/if}
				<span class="stats-sep">·</span>
				<span>{outputStats.size}</span>
			</div>
		{/if}

		{#if resultView === 'diff' && diffStats}
			<div class="stats-bar">
				{#if diffStats.added}
					<span class="accent-green">+{diffStats.added}</span>
				{/if}
				{#if diffStats.removed}
					<span class="accent-red">-{diffStats.removed}</span>
				{/if}
				{#if diffStats.modified}
					<span class="accent-gold">~{diffStats.modified}</span>
				{/if}
				<span class="stats-sep">·</span>
				<span>{diffStats.unchanged} unchanged</span>
				<span class="stats-sep">·</span>
				<span>{diffStats.total} total lines</span>
			</div>
		{/if}
	</div>
</article>

<style>
	.view-tabs {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}

	.view-tab {
		background: transparent;
		border: none;
		color: var(--gray);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		padding: 0.35rem 0.85rem;
		cursor: pointer;
		transition: all 0.15s;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.view-tab + .view-tab {
		border-left: 1px solid var(--border);
	}

	.view-tab:hover {
		color: var(--fg);
		background: rgba(128, 128, 128, 0.06);
	}

	.view-tab-active {
		color: var(--fg);
		background: rgba(128, 128, 128, 0.08);
		font-weight: 700;
	}

	.diff-badge {
		font-size: 0.65rem;
		background: var(--accent-gold);
		color: #000;
		border-radius: 999px;
		min-width: 1.2em;
		padding: 0 0.35rem;
		font-weight: 700;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		vertical-align: middle;
		height: 1.15rem;
	}
</style>
