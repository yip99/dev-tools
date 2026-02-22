<!-- src/routes/regex/+page.svelte -->
<script>
	import AlertBox from '$lib/components/AlertBox.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { copyToClipboard } from '$lib/utils/clipboard.js';

	let pattern = $state('');
	let testString = $state('');
	let replaceInput = $state('');
	let extractTemplate = $state('$0');

	let flagG = $state(true);
	let flagI = $state(false);
	let flagM = $state(false);
	let flagS = $state(false);

	let mode = $state('match');
	let copied = $state({});
	let hoverMatch = $state(-1);

	let textareaEl = $state(null);
	let backdropEl = $state(null);
	let matchTime = $state(0);
	let matches = $state([]);

	let flags = $derived(
		(flagG ? 'g' : '') + (flagI ? 'i' : '') + (flagM ? 'm' : '') + (flagS ? 's' : '')
	);

	let regexString = $derived(pattern ? `/${pattern}/${flags}` : '');

	let regexResult = $derived.by(() => {
		if (!pattern) return { regex: null, error: null };
		try {
			return { regex: new RegExp(pattern, flags), error: null };
		} catch (e) {
			return { regex: null, error: e.message.replace(/^Invalid regular expression:\s*/, '') };
		}
	});

	$effect(() => {
		const { regex } = regexResult;
		if (!regex || !testString) {
			matchTime = 0;
			matches = [];
			return;
		}
		try {
			const start = performance.now();
			const r = new RegExp(regex.source, regex.flags);
			const results = [];
			const limit = 1000;
			let match;

			if (r.global) {
				let i = 0;
				while ((match = r.exec(testString)) !== null && i < limit) {
					results.push(toMatchEntry(match));
					if (match[0].length === 0) r.lastIndex++;
					i++;
				}
			} else {
				match = r.exec(testString);
				if (match) results.push(toMatchEntry(match));
			}

			matchTime = (performance.now() - start) * 1000;
			matches = results;
		} catch {
			matchTime = 0;
			matches = [];
		}
	});

	function toMatchEntry(match) {
		return {
			full: match[0],
			index: match.index,
			end: match.index + match[0].length,
			groups: [...match].slice(1),
			namedGroups: match.groups ? { ...match.groups } : null
		};
	}

	let segments = $derived.by(() => {
		if (!matches.length || !testString) {
			return testString ? [{ text: testString, type: 'plain' }] : [];
		}
		const segs = [];
		let lastEnd = 0;
		for (let i = 0; i < matches.length; i++) {
			const m = matches[i];
			if (m.index > lastEnd) {
				segs.push({ text: testString.slice(lastEnd, m.index), type: 'plain' });
			}
			segs.push({ text: m.full, type: 'match', matchIndex: i });
			lastEnd = m.end;
		}
		if (lastEnd < testString.length) {
			segs.push({ text: testString.slice(lastEnd), type: 'plain' });
		}
		return segs;
	});

	let replaceResult = $derived.by(() => {
		const { regex } = regexResult;
		if (!regex || !testString) return null;
		try {
			return testString.replace(
				new RegExp(regex.source, regex.flags),
				unescapeString(replaceInput)
			);
		} catch {
			return null;
		}
	});

	let extractResults = $derived.by(() => {
		if (!matches.length || !extractTemplate) return [];
		const template = unescapeString(extractTemplate);
		return matches.map((m) => {
			let output = template;
			output = output.replace(/\$\$/g, '\x00DOLLAR\x00');
			output = output.replace(/\$&|\$0/g, m.full);
			m.groups.forEach((g, i) => {
				output = output.replace(new RegExp(`\\$${i + 1}`, 'g'), g ?? '');
			});
			if (m.namedGroups) {
				for (const [name, value] of Object.entries(m.namedGroups)) {
					output = output.replace(new RegExp(`\\$<${name}>`, 'g'), value ?? '');
				}
			}
			output = output.replace(/\x00DOLLAR\x00/g, '$');
			return output;
		});
	});

	let extractOutput = $derived(extractResults.join(''));

	function unescapeString(str) {
		return str
			.replace(/\\\\/g, '\x00ESC\x00')
			.replace(/\\n/g, '\n')
			.replace(/\\t/g, '\t')
			.replace(/\\r/g, '\r')
			.replace(/\\0/g, '\0')
			.replace(/\x00ESC\x00/g, '\\');
	}

	const MATCH_COLORS = [
		'rgba(251, 191, 36, 0.3)',
		'rgba(59, 130, 246, 0.3)',
		'rgba(34, 197, 94, 0.25)',
		'rgba(168, 85, 247, 0.3)'
	];

	function matchColor(index) {
		return MATCH_COLORS[index % MATCH_COLORS.length];
	}

	function syncScroll() {
		if (backdropEl && textareaEl) {
			backdropEl.style.transform = `translate(-${textareaEl.scrollLeft}px, -${textareaEl.scrollTop}px)`;
		}
	}

	function loadSample() {
		pattern = '(?<user>\\w+)@(?<domain>\\w+\\.\\w+)';
		testString =
			'Contact us at hello@example.com or support@devtools.io for help.\nAlso try admin@test.org for testing.';
		replaceInput = '[$<user> at $<domain>]';
		extractTemplate = 'User: $<user>, Domain: $<domain>';
	}

	function clear() {
		pattern = '';
		testString = '';
		replaceInput = '';
		extractTemplate = '$0';
	}

	function setCopied(key, value) {
		copied = { ...copied, [key]: value };
	}

	async function copyValue(key, text) {
		await copyToClipboard(key, text, setCopied);
	}
</script>

<svelte:head>
	<title>Regex Builder - DevTools</title>
</svelte:head>

<article class="post">
	<header class="post-header">
		<h1>Regex Builder</h1>
		<span class="post-date"
			>Test patterns. <span class="accent-green">Live matches</span> and
			<span class="accent-purple">capture groups</span> highlighted.</span
		>
	</header>

	<p>
		Build and test regular expressions. Replace matches or extract capture groups with templates.
		Use <code>$1</code>, <code>$2</code> for groups, <code>$&lt;name&gt;</code> for named groups,
		<code>$$</code>
		for literal <code>$</code>.
	</p>

	<!-- Pattern -->
	<div class="input-group">
		<div class="label-row">
			<label for="regex-pattern">Pattern</label>
			<div class="flag-toggles">
				<button
					class="flag-btn"
					class:flag-active={flagG}
					onclick={() => (flagG = !flagG)}
					title="Global">g</button
				>
				<button
					class="flag-btn"
					class:flag-active={flagI}
					onclick={() => (flagI = !flagI)}
					title="Case insensitive">i</button
				>
				<button
					class="flag-btn"
					class:flag-active={flagM}
					onclick={() => (flagM = !flagM)}
					title="Multiline">m</button
				>
				<button
					class="flag-btn"
					class:flag-active={flagS}
					onclick={() => (flagS = !flagS)}
					title="Dotall">s</button
				>
			</div>
		</div>
		<div class="pattern-wrap">
			<span class="pattern-delim">/</span>
			<input
				id="regex-pattern"
				type="text"
				class="pattern-field"
				bind:value={pattern}
				placeholder="\\w+@\\w+\\.\\w+"
				spellcheck="false"
				autocomplete="off"
			/>
			<span class="pattern-delim">/</span>
			<span class="pattern-flags">{flags || '\u00a0'}</span>
			{#if pattern}
				<button
					class="copy-regex-btn"
					onclick={() => copyValue('regex', regexString)}
					title="Copy regex"
				>
					{#if copied.regex}
						<span class="accent-green">✓</span>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="14"
							height="14"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
							/>
						</svg>
					{/if}
				</button>
			{/if}
		</div>
	</div>

	{#if regexResult.error}
		<AlertBox type="error">{regexResult.error}</AlertBox>
	{/if}

	<!-- Controls -->
	<div class="controls-wrapper">
		<div class="controls-row">
			<div class="btn-group">
				<button class="btn-secondary" onclick={loadSample}>Sample</button>
			</div>
			<div class="controls-row right-align">
				<button class="text-btn" onclick={clear} disabled={!pattern && !testString}
					>Clear All</button
				>
			</div>
		</div>
	</div>

	<!-- Test String with inline highlights -->
	<div class="input-group">
		<div class="label-row">
			<label for="test-string">Test String</label>
			{#if matches.length > 0}
				<span class="match-count">
					{matches.length} match{matches.length === 1 ? '' : 'es'} ·
					{#if matchTime < 1000}
						{matchTime.toFixed(3)}µs
					{:else}
						{(matchTime / 1000).toFixed(3)}ms
					{/if}
				</span>
			{/if}
		</div>
		<div class="textarea-hl-wrap">
			<div class="textarea-backdrop-clip" aria-hidden="true">
				<div class="textarea-backdrop" bind:this={backdropEl}>
					{#each segments as seg}{#if seg.type === 'match'}<mark
								class="match-hl"
								class:match-hl-hover={hoverMatch === seg.matchIndex}
								style:background={matchColor(seg.matchIndex)}>{seg.text}</mark
							>{:else}{seg.text}{/if}{/each}{#if !segments.length}{testString}{/if}
				</div>
			</div>
			<textarea
				id="test-string"
				bind:this={textareaEl}
				bind:value={testString}
				onscroll={syncScroll}
				placeholder="Enter text to test against..."
				rows="5"
				spellcheck="false"
			></textarea>
		</div>
	</div>

	<!-- Mode Tabs -->
	{#if testString && pattern && !regexResult.error}
		<div class="mode-tabs">
			<button
				class="mode-tab"
				class:mode-tab-active={mode === 'match'}
				onclick={() => (mode = 'match')}
			>
				Matches
				{#if matches.length > 0}
					<span class="tab-badge">{matches.length}</span>
				{/if}
			</button>
			<button
				class="mode-tab"
				class:mode-tab-active={mode === 'replace'}
				onclick={() => (mode = 'replace')}
			>
				Replace
			</button>
			<button
				class="mode-tab"
				class:mode-tab-active={mode === 'extract'}
				onclick={() => (mode = 'extract')}
			>
				Extract
			</button>
		</div>

		<!-- Match Details -->
		{#if mode === 'match'}
			{#if matches.length > 0}
				<div class="input-group">
					<div class="label-row">
						<label>Match Details</label>
					</div>
					<div class="result-card">
						{#each matches as m, i}
							<div
								class="match-row"
								class:match-row-hover={hoverMatch === i}
								onmouseenter={() => (hoverMatch = i)}
								onmouseleave={() => (hoverMatch = -1)}
							>
								<div class="match-header">
									<span class="match-idx" style:background={matchColor(i)}>{i + 1}</span>
									<span class="match-full">"{m.full}"</span>
									<span class="match-pos">@{m.index}–{m.end}</span>
									<button class="copy-btn" onclick={() => copyValue(`m${i}`, m.full)}>
										{copied[`m${i}`] ? 'Copied!' : 'Copy'}
									</button>
								</div>
								{#if m.groups.length > 0}
									<div class="match-groups">
										{#each m.groups as group, gi}
											<div class="group-item">
												<span class="group-label">${gi + 1}</span>
												<span class="group-value"
													>{group !== undefined ? group : '(undefined)'}</span
												>
											</div>
										{/each}
									</div>
								{/if}
								{#if m.namedGroups}
									<div class="match-groups">
										{#each Object.entries(m.namedGroups) as [name, value]}
											<div class="group-item">
												<span class="group-label">$&lt;{name}&gt;</span>
												<span class="group-value"
													>{value !== undefined ? value : '(undefined)'}</span
												>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<AlertBox type="info">No matches found.</AlertBox>
			{/if}
		{/if}

		<!-- Replace -->
		{#if mode === 'replace'}
			<div class="input-group">
				<div class="label-row">
					<label for="replace-input">Replace with</label>
					<span class="hint"
						>$1 $2 groups · $&lt;name&gt; named · $& full · $$ literal $ · \n \t</span
					>
				</div>
				<input
					id="replace-input"
					type="text"
					bind:value={replaceInput}
					placeholder="[$<user> at $<domain>]"
					spellcheck="false"
				/>
			</div>

			{#if replaceResult !== null && matches.length > 0}
				<div class="input-group">
					<div class="label-row">
						<label>Result</label>
						<button class="copy-btn" onclick={() => copyValue('replace', replaceResult)}>
							{copied.replace ? 'Copied!' : 'Copy'}
						</button>
					</div>
					<CodeEditor
						value={replaceResult}
						readonly
						rows={Math.min(replaceResult.split('\n').length + 1, 12)}
					/>
				</div>
			{:else if matches.length === 0}
				<AlertBox type="info">No matches to replace.</AlertBox>
			{/if}
		{/if}

		<!-- Extract -->
		{#if mode === 'extract'}
			<div class="input-group">
				<div class="label-row">
					<label for="extract-template">Template</label>
					<span class="hint"
						>$0 full · $1 $2 groups · $&lt;name&gt; named · $$ literal $ · \n \t</span
					>
				</div>
				<input
					id="extract-template"
					type="text"
					bind:value={extractTemplate}
					placeholder="$<user>\n"
					spellcheck="false"
				/>
			</div>

			{#if extractResults.length > 0}
				<div class="input-group">
					<div class="label-row">
						<label>Extracted ({extractResults.length})</label>
						<button class="copy-btn" onclick={() => copyValue('extract', extractOutput)}>
							{copied.extract ? 'Copied!' : 'Copy'}
						</button>
					</div>
					<CodeEditor
						value={extractOutput}
						readonly
						rows={Math.min(extractResults.length + 1, 12)}
					/>
				</div>
			{:else if matches.length === 0}
				<AlertBox type="info">No matches to extract from.</AlertBox>
			{/if}
		{/if}
	{/if}

	{#if !testString && !pattern}
		<div class="calibrating-box">Enter a pattern and test string to begin.</div>
	{/if}
</article>

<style>
	.pattern-wrap {
		display: flex;
		align-items: center;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0 0.75rem;
		transition: border-color 0.2s;
	}

	.pattern-wrap:focus-within {
		border-color: var(--accent-gold);
	}

	.pattern-delim {
		color: var(--accent-green);
		font-weight: 700;
		font-size: 1.1rem;
		user-select: none;
		flex-shrink: 0;
	}

	.pattern-field {
		flex: 1;
		min-width: 0;
		border: none;
		padding: 0.75rem 0.5rem;
		background: transparent;
		color: var(--fg);
		font-family: var(--font-mono);
		font-size: 0.95rem;
	}

	.pattern-field:focus {
		outline: none;
		border-color: transparent;
	}

	.pattern-flags {
		color: var(--accent-green);
		font-weight: 700;
		font-size: 0.9rem;
		min-width: 2rem;
		user-select: none;
		flex-shrink: 0;
	}

	.copy-regex-btn {
		background: none;
		border: 1px solid var(--border);
		color: var(--gray);
		font-size: 1rem;
		width: 2rem;
		height: 2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		cursor: pointer;
		flex-shrink: 0;
		margin-left: 0.25rem;
		transition: all 0.15s;
	}

	.copy-regex-btn:hover {
		border-color: var(--gray);
		color: var(--fg);
	}

	.flag-toggles {
		display: flex;
		gap: 0.25rem;
	}

	.flag-btn {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--gray);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 700;
		width: 1.75rem;
		height: 1.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.flag-btn:hover {
		border-color: var(--gray);
		color: var(--fg);
	}

	.flag-btn.flag-active {
		background: var(--fg);
		color: var(--bg);
		border-color: var(--fg);
	}

	.textarea-hl-wrap {
		position: relative;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
		transition: border-color 0.2s;
	}

	.textarea-hl-wrap:focus-within {
		border-color: var(--accent-gold);
	}

	.textarea-backdrop-clip {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
	}

	.textarea-backdrop {
		padding: 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-wrap: break-word;
		overflow-wrap: break-word;
		color: transparent;
		will-change: transform;
	}

	.textarea-hl-wrap textarea {
		position: relative;
		z-index: 1;
		display: block;
		width: 100%;
		padding: 0.75rem;
		border: none;
		background: transparent;
		color: var(--fg);
		font-family: var(--font-mono);
		font-size: 0.9rem;
		line-height: 1.6;
		resize: vertical;
		white-space: pre-wrap;
		word-wrap: break-word;
		overflow-wrap: break-word;
		caret-color: var(--fg);
	}

	.textarea-hl-wrap textarea:focus {
		outline: none;
	}

	.textarea-hl-wrap textarea::placeholder {
		color: var(--gray);
		opacity: 0.4;
	}

	.match-hl {
		color: transparent;
		border-radius: 2px;
		padding: 1px 0;
		transition: outline 0.1s;
	}

	.match-hl.match-hl-hover {
		outline: 2px solid var(--accent-gold);
		outline-offset: 1px;
	}

	.textarea-backdrop mark {
		pointer-events: auto;
		cursor: default;
	}

	.match-count {
		font-size: 0.75rem;
		color: var(--accent-green);
		font-family: var(--font-mono);
	}

	.match-row {
		padding: 0.65rem 0.75rem;
		border-bottom: 1px solid var(--border);
		transition: background 0.1s;
	}

	.match-row:last-child {
		border-bottom: none;
	}

	.match-row.match-row-hover {
		background: rgba(128, 128, 128, 0.05);
	}

	.match-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.match-idx {
		font-size: 0.7rem;
		font-weight: 700;
		min-width: 1.5rem;
		height: 1.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.match-full {
		font-size: 0.85rem;
		word-break: break-all;
		flex: 1;
		min-width: 0;
	}

	.match-pos {
		font-size: 0.7rem;
		color: var(--gray);
		opacity: 0.6;
		flex-shrink: 0;
	}

	.match-groups {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.4rem;
		padding-left: 2rem;
		flex-wrap: wrap;
	}

	.group-item {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
	}

	.group-label {
		color: var(--accent-purple);
		font-size: 0.7rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.group-value {
		color: var(--fg);
		font-size: 0.8rem;
		word-break: break-all;
	}
</style>
