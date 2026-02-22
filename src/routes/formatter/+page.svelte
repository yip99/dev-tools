<!-- src/routes/formatter/+page.svelte -->
<script>
	import { untrack, onDestroy } from 'svelte';
	import AlertBox from '$lib/components/AlertBox.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { computeDiff } from '$lib/utils/diff.js';
	import { computeDiffStats } from '$lib/utils/diffstats.js';
	import { byteSize, formatSize, sizeDelta } from '$lib/utils/bytes.js';
	import { copyToClipboard } from '$lib/utils/clipboard.js';
	import { detectLanguage } from '$lib/utils/highlight.js';
	import {
		formatCode,
		minifyCode,
		parseJSON,
		stripColonSpaces,
		stripNulls,
		sortKeys
	} from '$lib/utils/format.js';
	import { throttle } from '$lib/utils/throttle.js';
	import { parseErrorLine } from '$lib/utils/errors.js';
	import { computeJsonPaths, getValueType } from '$lib/utils/jsonpath.js';

	let input = $state('');
	let output = $state('');
	let error = $state(null);
	let errorLine = $state(-1);
	let copyLabel = $state('Copy');
	let pathCopyLabel = $state('Copy');
	let formatting = $state(false);
	let selectedOutputLine = $state(-1);

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
	let formatOptions = $derived({ indent: indentValue, indentSize });

	// ── JSON path (debounced) ───────────────────────────────────

	let jsonPaths = $state(null);

	$effect(() => {
		const json = isJSON;
		const text = output;
		const view = resultView;

		if (!json || !text?.trim() || view !== 'formatted') {
			jsonPaths = null;
			return;
		}

		const timer = setTimeout(() => {
			try {
				jsonPaths = computeJsonPaths(text);
			} catch {
				jsonPaths = null;
			}
		}, 150);

		return () => clearTimeout(timer);
	});

	let selectedPath = $derived.by(() => {
		if (!jsonPaths || selectedOutputLine < 0 || selectedOutputLine >= jsonPaths.length) {
			return null;
		}
		return jsonPaths[selectedOutputLine];
	});

	let selectedValueType = $derived.by(() => {
		if (selectedOutputLine < 0 || !output) return null;
		const lines = output.split('\n');
		if (selectedOutputLine >= lines.length) return null;
		return getValueType(lines[selectedOutputLine]);
	});

	$effect(() => {
		void output;
		selectedOutputLine = -1;
	});

	function handleOutputLineClick(line) {
		selectedOutputLine = selectedOutputLine === line ? -1 : line;
		pathCopyLabel = 'Copy';
	}

	async function copyPath() {
		if (!selectedPath) return;
		await copyToClipboard('path', selectedPath, (_, v) => {
			pathCopyLabel = v ? 'Copied!' : 'Copy';
		});
	}

	// ── Throttled auto-format ───────────────────────────────────

	const throttledApply = throttle(() => applyMode(), 300);

	onDestroy(() => throttledApply.cancel());

	$effect(() => {
		if (!autoFormat) return;
		const hasInput = input.trim();
		untrack(() => {
			if (hasInput) {
				throttledApply();
			} else {
				throttledApply.cancel();
				output = '';
				clearError();
			}
		});
	});

	$effect(() => {
		void indentValue;
		void removeNulls;
		void spaceAfterColon;
		void languageChoice;
		untrack(() => {
			if (input.trim()) throttledApply();
		});
	});

	// ── Error handling ──────────────────────────────────────────

	function setError(message) {
		error = message;
		errorLine = parseErrorLine(message, input);
	}

	function clearError() {
		error = null;
		errorLine = -1;
	}

	// ── JSON transforms ─────────────────────────────────────────

	function jsonStringify(data, indent = null) {
		let result = JSON.stringify(data, null, indent);
		if (!spaceAfterColon && indent) {
			result = stripColonSpaces(result);
		}
		return result;
	}

	/**
	 * Parse input → transform → output. Sync.
	 * parseJSON accepts messy input (comments, unquoted keys, etc.)
	 * JSON.stringify guarantees strict output.
	 */
	function processJSON(transformFn) {
		if (!input.trim()) return;
		try {
			let parsed = parseJSON(input);
			if (removeNulls) parsed = stripNulls(parsed);
			output = transformFn(parsed);
			clearError();
		} catch (e) {
			setError('Invalid JSON: ' + e.message);
			output = '';
		}
	}

	// ── Mode application ────────────────────────────────────────

	async function applyMode() {
		if (!input.trim()) return;

		if (isJSON) {
			if (lastMode === 'minify') {
				processJSON((d) => JSON.stringify(d));
			} else if (lastMode === 'sort') {
				processJSON((d) => jsonStringify(sortKeys(d), indentValue));
			} else {
				processJSON((d) => jsonStringify(d, indentValue));
			}
			return;
		}

		if (lastMode === 'minify') {
			try {
				output = minifyCode(input, language);
				clearError();
			} catch (e) {
				setError(`Minify error: ${e.message}`);
				output = '';
			}
			return;
		}

		if (canFormat) {
			formatting = true;
			try {
				output = await formatCode(input, language, formatOptions);
				clearError();
			} catch (e) {
				setError(`Format error: ${e.message}`);
				output = '';
			} finally {
				formatting = false;
			}
			return;
		}

		output = input;
		clearError();
	}

	function doFormat() {
		lastMode = 'format';
		throttledApply.cancel();
		applyMode();
	}

	function doMinify() {
		lastMode = 'minify';
		throttledApply.cancel();
		applyMode();
	}

	function doSort() {
		lastMode = 'sort';
		throttledApply.cancel();
		applyMode();
	}

	function escapeJSON() {
		if (!input.trim()) return;
		throttledApply.cancel();
		output = JSON.stringify(input);
		clearError();
	}

	function unescapeJSON() {
		if (!input.trim()) return;
		throttledApply.cancel();
		try {
			const parsed = JSON.parse(input);
			output = typeof parsed === 'string' ? parsed : jsonStringify(parsed, indentValue);
			clearError();
		} catch (e) {
			setError('Could not unescape: ' + e.message);
			output = '';
		}
	}

	// ── UI utilities ────────────────────────────────────────────

	function clear() {
		throttledApply.cancel();
		input = '';
		output = '';
		clearError();
		selectedOutputLine = -1;
	}

	async function copyOutput() {
		if (!output) return;
		await copyToClipboard('output', output, (_, v) => {
			copyLabel = v ? 'Copied!' : 'Copy';
		});
	}

	const SAMPLES = {
		json: `{
  // User profile (JSON5 input)
  id: 1,
  name: 'DevTool User',
  active: true,
  score: 42.5,
  empty: null,
  tags: ["admin", "dev"],
  /* trailing comma below */
  list: [1, 2, 3,],
}`,
		javascript:
			'// User service\nconst getUser=async(id)=>{const res=await fetch(`/api/users/${id}`);if(!res.ok){throw new Error("Not found")}const data=await res.json();return{id:data.id,name:data.name,active:true,tags:["admin","dev"]}};',
		html: '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Hello</title><link rel="stylesheet" href="style.css"></head><body><div class="container"><h1>Hello World</h1><p>This is a <strong>test</strong> paragraph.</p><ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul></div><script src="app.js"><\/script></body></html>',
		css: ':root{--bg:#111;--fg:#eee;--accent:#fbbf24}.container{max-width:680px;margin:0 auto;padding:2rem 1.5rem;display:flex;flex-direction:column}.container h1{font-size:1.8rem;color:var(--fg);margin-bottom:.5rem}@media(max-width:640px){.container{padding:1rem}.container h1{font-size:1.4rem}}'
	};

	function loadSample() {
		if (languageChoice === 'auto') languageChoice = 'json';
		input = SAMPLES[language] || SAMPLES.json;
		if (!autoFormat) {
			throttledApply.cancel();
			applyMode();
		}
	}

	// ── Stats ───────────────────────────────────────────────────

	function countKeys(obj) {
		if (typeof obj !== 'object' || obj === null) return 0;
		if (Array.isArray(obj)) return obj.reduce((sum, item) => sum + countKeys(item), 0);
		return Object.keys(obj).length + Object.values(obj).reduce((sum, v) => sum + countKeys(v), 0);
	}

	function languageLabel(lang) {
		if (!lang) return 'Code';
		const labels = { json: 'JSON', javascript: 'JS', html: 'HTML', css: 'CSS' };
		return labels[lang] || lang.toUpperCase();
	}

	function textStats(text) {
		if (!text?.trim()) return null;
		const lines = text.split('\n').length;
		const bytes = byteSize(text);
		const size = formatSize(bytes);
		let keys = null;
		if (isJSON) {
			try {
				keys = countKeys(JSON.parse(text));
			} catch {}
		}
		return { lines, keys, size, bytes };
	}

	let inputStats = $derived(textStats(input));
	let outputStats = $derived(textStats(output));

	let delta = $derived(
		inputStats && outputStats ? sizeDelta(inputStats.bytes, outputStats.bytes) : null
	);

	let diffStats = $derived(computeDiffStats(diff.markers));
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
			Accepts JSON5 input — comments, unquoted keys, single quotes, trailing commas. Always outputs
			valid standard JSON. Click a line to see its path.
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
			error={!!error}
			{errorLine}
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
		<AlertBox type="error">
			{error}
			{#if errorLine >= 0}
				<span class="error-location">Line {errorLine + 1}</span>
			{/if}
		</AlertBox>
	{/if}

	<div class="input-group output-group">
		<div class="label-row">
			<div class="mode-tabs">
				<button
					class="mode-tab"
					class:mode-tab-active={resultView === 'formatted'}
					onclick={() => (resultView = 'formatted')}
				>
					Result
				</button>
				<button
					class="mode-tab"
					class:mode-tab-active={resultView === 'diff'}
					onclick={() => (resultView = 'diff')}
				>
					Diff
					{#if diffStats && (diffStats.added || diffStats.removed || diffStats.modified)}
						<span class="tab-badge tab-badge-gold"
							>{diffStats.added + diffStats.removed + diffStats.modified}</span
						>
					{/if}
				</button>
			</div>
			{#if output && resultView === 'formatted'}
				<button class="text-btn" onclick={copyOutput}>{copyLabel}</button>
			{/if}
		</div>

		{#if resultView === 'formatted'}
			<CodeEditor
				id="code-output"
				value={output}
				readonly
				placeholder="Result will appear here..."
				rows={8}
				wrap={wrapLines}
				{language}
				onLineClick={isJSON && jsonPaths ? handleOutputLineClick : undefined}
				selectedLine={isJSON ? selectedOutputLine : -1}
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

		{#if isJSON && jsonPaths && output}
			<div class="path-bar" class:path-bar-active={selectedPath}>
				<span class="path-label">Path</span>
				{#if selectedPath}
					<code class="path-value">{selectedPath}</code>
					{#if selectedValueType}
						<span class="path-type">{selectedValueType}</span>
					{/if}
					<button class="path-copy" onclick={copyPath}>{pathCopyLabel}</button>
					<button class="path-dismiss" onclick={() => (selectedOutputLine = -1)} title="Dismiss"
						>×</button
					>
				{:else}
					<span class="path-hint">Click a line to inspect its path</span>
				{/if}
			</div>
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
				{#if delta}
					<span class="stats-sep">·</span>
					<span
						class="size-delta"
						class:size-smaller={delta.diff < 0}
						class:size-larger={delta.diff > 0}
					>
						{delta.diff > 0 ? '+' : '−'}{delta.formatted}
						({delta.diff > 0 ? '+' : '−'}{Math.abs(delta.pct).toFixed(1)}%)
					</span>
				{/if}
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
	.tab-badge-gold {
		background: var(--accent-gold);
	}

	.error-location {
		display: inline-block;
		margin-left: 0.5rem;
		padding: 0.1rem 0.4rem;
		font-size: 0.75rem;
		font-weight: 700;
		background: rgba(255, 77, 77, 0.15);
		border-radius: 3px;
		color: var(--accent-red);
	}

	.path-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.75rem;
		margin-top: 0.35rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: rgba(128, 128, 128, 0.03);
		font-size: 0.8rem;
		min-height: 2.25rem;
		box-sizing: border-box;
		transition:
			border-color 0.2s,
			background 0.2s;
	}

	.path-bar-active {
		border-color: var(--accent-blue);
		background: rgba(59, 130, 246, 0.05);
	}

	.path-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--gray);
		font-weight: 700;
		flex-shrink: 0;
		transition: color 0.2s;
	}

	.path-bar-active .path-label {
		color: var(--accent-blue);
	}

	.path-hint {
		color: var(--gray);
		opacity: 0.5;
		font-size: 0.75rem;
		font-style: italic;
	}

	.path-value {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--fg);
		word-break: break-all;
		flex: 1;
		min-width: 0;
		background: none;
		padding: 0;
	}

	.path-type {
		font-size: 0.65rem;
		color: var(--gray);
		opacity: 0.7;
		flex-shrink: 0;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		background: rgba(128, 128, 128, 0.08);
	}

	.path-copy {
		background: none;
		border: none;
		color: var(--accent-blue);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
		flex-shrink: 0;
		white-space: nowrap;
	}

	.path-copy:hover {
		opacity: 0.7;
	}

	.path-dismiss {
		background: none;
		border: none;
		color: var(--gray);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 0.15rem;
		flex-shrink: 0;
		opacity: 0.5;
		transition: opacity 0.15s;
	}

	.path-dismiss:hover {
		opacity: 1;
		color: var(--fg);
	}
</style>
