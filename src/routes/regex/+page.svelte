<!-- src/routes/regex/+page.svelte -->
<script>
	import AlertBox from '$lib/components/AlertBox.svelte';

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

	let flags = $derived(
		(flagG ? 'g' : '') + (flagI ? 'i' : '') + (flagM ? 'm' : '') + (flagS ? 's' : '')
	);

	let regexResult = $derived.by(() => {
		if (!pattern) return { regex: null, error: null };
		try {
			return { regex: new RegExp(pattern, flags), error: null };
		} catch (e) {
			return { regex: null, error: e.message.replace(/^Invalid regular expression:\s*/, '') };
		}
	});

	let matches = $derived.by(() => {
		const { regex } = regexResult;
		if (!regex || !testString) return [];
		try {
			const r = new RegExp(regex.source, regex.flags);
			const results = [];
			let match;
			const limit = 1000;
			if (r.global) {
				let i = 0;
				while ((match = r.exec(testString)) !== null && i < limit) {
					results.push({
						full: match[0],
						index: match.index,
						end: match.index + match[0].length,
						groups: [...match].slice(1),
						namedGroups: match.groups ? { ...match.groups } : null
					});
					if (match[0].length === 0) r.lastIndex++;
					i++;
				}
			} else {
				match = r.exec(testString);
				if (match) {
					results.push({
						full: match[0],
						index: match.index,
						end: match.index + match[0].length,
						groups: [...match].slice(1),
						namedGroups: match.groups ? { ...match.groups } : null
					});
				}
			}
			return results;
		} catch {
			return [];
		}
	});

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
			return testString.replace(new RegExp(regex.source, regex.flags), replaceInput);
		} catch {
			return null;
		}
	});

	let replaceSegments = $derived.by(() => {
		if (replaceResult === null || replaceResult === testString) return null;
		const { regex } = regexResult;
		if (!regex) return null;
		try {
			const rr = new RegExp(regex.source, regex.flags);
			const segs = [];
			const original = testString;
			const replaced = replaceResult;
			const replacements = [];
			let m;
			if (rr.global) {
				while ((m = rr.exec(original)) !== null) {
					replacements.push({ index: m.index, end: m.index + m[0].length, original: m[0] });
					if (m[0].length === 0) rr.lastIndex++;
				}
			} else {
				m = rr.exec(original);
				if (m) replacements.push({ index: m.index, end: m.index + m[0].length, original: m[0] });
			}

			let srcPos = 0;
			let dstPos = 0;
			for (const rep of replacements) {
				const beforeLen = rep.index - srcPos;
				if (beforeLen > 0) {
					segs.push({ text: replaced.slice(dstPos, dstPos + beforeLen), type: 'plain' });
					dstPos += beforeLen;
				}
				srcPos = rep.end;
				const singleRep = rep.original.replace(
					new RegExp(regex.source, regex.flags.replace('g', '')),
					replaceInput
				);
				segs.push({ text: singleRep, type: 'replaced' });
				dstPos += singleRep.length;
			}
			if (dstPos < replaced.length) {
				segs.push({ text: replaced.slice(dstPos), type: 'plain' });
			}
			return segs;
		} catch {
			return null;
		}
	});

	let extractResults = $derived.by(() => {
		if (!matches.length || !extractTemplate) return [];
		return matches.map((m) => {
			let output = extractTemplate;
			output = output.replace(/\$&|\$0/g, m.full);
			m.groups.forEach((g, i) => {
				output = output.replace(new RegExp(`\\$${i + 1}`, 'g'), g ?? '');
			});
			if (m.namedGroups) {
				for (const [name, value] of Object.entries(m.namedGroups)) {
					output = output.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), value ?? '');
				}
			}
			return output;
		});
	});

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
			backdropEl.scrollTop = textareaEl.scrollTop;
			backdropEl.scrollLeft = textareaEl.scrollLeft;
		}
	}

	function loadSample() {
		pattern = '(\\w+)@(\\w+\\.\\w+)';
		testString =
			'Contact us at hello@example.com or support@devtools.io for help.\nAlso try admin@test.org for testing.';
		replaceInput = '[$1 at $2]';
		extractTemplate = 'User: $1, Domain: $2';
	}

	function clear() {
		pattern = '';
		testString = '';
		replaceInput = '';
		extractTemplate = '$0';
	}

	async function copyValue(key, text) {
		try {
			await navigator.clipboard.writeText(text);
			copied = { ...copied, [key]: true };
			setTimeout(() => {
				copied = { ...copied, [key]: false };
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
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
		Use <code>$1</code>, <code>$2</code> for groups, <code>${'{name}'}</code> for named groups.
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
				<span class="match-count">{matches.length} match{matches.length === 1 ? '' : 'es'}</span>
			{/if}
		</div>
		<div class="textarea-hl-wrap">
			<div class="textarea-backdrop" bind:this={backdropEl} aria-hidden="true">
				{#each segments as seg}{#if seg.type === 'match'}<mark
							class="match-hl"
							class:match-hl-hover={hoverMatch === seg.matchIndex}
							style:background={matchColor(seg.matchIndex)}
							onmouseenter={() => (hoverMatch = seg.matchIndex)}
							onmouseleave={() => (hoverMatch = -1)}>{seg.text}</mark
						>{:else}{seg.text}{/if}{/each}{#if !segments.length}{testString}{/if}
			</div>
			<textarea
				id="test-string"
				bind:this={textareaEl}
				bind:value={testString}
				oninput={syncScroll}
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
												<span class="group-label">${'{' + name + '}'}</span>
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
					<span class="hint">$1, $2 for groups · $& for full match</span>
				</div>
				<input
					id="replace-input"
					type="text"
					bind:value={replaceInput}
					placeholder="[$1 at $2]"
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
					<div class="output-view">
						{#if replaceSegments}{#each replaceSegments as seg}{#if seg.type === 'replaced'}<mark
										class="replace-hl">{seg.text}</mark
									>{:else}{seg.text}{/if}{/each}{:else}{replaceResult}{/if}
					</div>
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
					<span class="hint">$0 full match · $1, $2 groups · ${'{name}'} named</span>
				</div>
				<input
					id="extract-template"
					type="text"
					bind:value={extractTemplate}
					placeholder="User: $1, Domain: $2"
					spellcheck="false"
				/>
			</div>

			{#if extractResults.length > 0}
				<div class="input-group">
					<div class="label-row">
						<label>Extracted ({extractResults.length})</label>
						<button
							class="copy-btn"
							onclick={() => copyValue('extract', extractResults.join('\n'))}
						>
							{copied.extract ? 'Copied!' : 'Copy All'}
						</button>
					</div>
					<div class="result-card">
						{#each extractResults as line, i}
							<div class="result-row">
								<span class="result-index">{i + 1}</span>
								<div class="result-value-row">
									<span class="result-value">{line}</span>
									<button class="copy-btn" onclick={() => copyValue(`e${i}`, line)}>
										{copied[`e${i}`] ? 'Copied!' : 'Copy'}
									</button>
								</div>
							</div>
						{/each}
					</div>
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
	/* --- Pattern Input --- */
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

	/* --- Flag Toggles --- */
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

	/* --- Textarea with Highlight Overlay --- */
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

	.textarea-backdrop {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-wrap: break-word;
		overflow-wrap: break-word;
		overflow: auto;
		color: transparent;
		pointer-events: none;
		z-index: 0;
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

	/* Allow pointer events on marks for hover interaction */
	.textarea-backdrop mark {
		pointer-events: auto;
		cursor: default;
	}

	/* --- Match Count --- */
	.match-count {
		font-size: 0.75rem;
		color: var(--accent-green);
		font-family: var(--font-mono);
	}

	/* --- Mode Tabs --- */
	.mode-tabs {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
		margin-bottom: 1.5rem;
		width: fit-content;
	}

	.mode-tab {
		background: transparent;
		border: none;
		color: var(--gray);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		padding: 0.4rem 1rem;
		cursor: pointer;
		transition: all 0.15s;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.mode-tab + .mode-tab {
		border-left: 1px solid var(--border);
	}

	.mode-tab:hover {
		color: var(--fg);
		background: rgba(128, 128, 128, 0.06);
	}

	.mode-tab-active {
		color: var(--fg);
		background: rgba(128, 128, 128, 0.08);
		font-weight: 700;
	}

	.tab-badge {
		font-size: 0.65rem;
		background: var(--accent-green);
		color: #000;
		border-radius: 999px;
		min-width: 1.2em;
		padding: 0 0.35rem;
		font-weight: 700;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 1.15rem;
	}

	/* --- Match Details --- */
	.result-card {
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
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

	/* --- Output View --- */
	.output-view {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
		overflow-x: auto;
		background: rgba(128, 128, 128, 0.03);
	}

	.replace-hl {
		background: rgba(34, 197, 94, 0.25);
		border-radius: 2px;
		padding: 1px 0;
		color: inherit;
	}

	/* --- Result Rows --- */
	.result-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.result-row:last-child {
		border-bottom: none;
	}

	.result-index {
		font-size: 0.7rem;
		color: var(--gray);
		opacity: 0.5;
		min-width: 1.5ch;
		text-align: right;
		flex-shrink: 0;
	}

	.result-value-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}

	.result-value {
		font-size: 0.85rem;
		word-break: break-all;
		line-height: 1.5;
	}

	/* --- Copy / Hint --- */
	.copy-btn {
		background: none;
		border: none;
		color: var(--gray);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
		flex-shrink: 0;
		white-space: nowrap;
	}

	.copy-btn:hover {
		color: var(--fg);
	}

	.hint {
		font-size: 0.7rem;
		color: var(--gray);
		opacity: 0.6;
		font-family: var(--font-mono);
	}

	code {
		font-family: var(--font-mono);
		font-size: 0.85em;
		padding: 0.15em 0.35em;
		border-radius: 3px;
		background: rgba(128, 128, 128, 0.1);
	}
</style>
