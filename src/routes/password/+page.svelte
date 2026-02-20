<!-- src/routes/password/+page.svelte -->
<script>
	import { browser } from '$app/environment';

	const CHARSETS = {
		lowercase: 'abcdefghijklmnopqrstuvwxyz',
		uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
		numbers: '0123456789',
		symbols: '!@#$%^&*()-_=+[]{}|;:,.<>?/~`'
	};

	// Mode: 'password' | 'uuid'
	let mode = $state('password');

	// Password settings
	let length = $state(16);
	let count = $state(1);
	let useLowercase = $state(true);
	let useUppercase = $state(true);
	let useNumbers = $state(true);
	let useSymbols = $state(true);
	let excludeChars = $state('');
	let showCharMap = $state(false);

	// Individual character toggles (built from charsets minus exclusions)
	let charToggles = $state(buildCharToggles());

	// Results
	let results = $state([]);
	let copied = $state({});

	// Available characters based on individual toggles
	let availableChars = $derived(
		Object.values(charToggles)
			.filter((t) => t.enabled)
			.map((t) => t.char)
			.join('')
	);

	let entropy = $derived.by(() => {
		if (mode === 'uuid') return 122; // UUID v4 has 122 bits
		const poolSize = availableChars.length;
		if (poolSize === 0) return 0;
		return Math.floor(length * Math.log2(poolSize));
	});

	let strength = $derived.by(() => {
		if (mode === 'uuid') return { label: 'UUID v4', color: 'var(--accent-purple)' };
		if (entropy === 0) return { label: 'None', color: 'var(--accent-red)' };
		if (entropy < 40) return { label: 'Weak', color: 'var(--accent-red)' };
		if (entropy < 60) return { label: 'Fair', color: 'var(--accent-gold)' };
		if (entropy < 80) return { label: 'Good', color: 'var(--accent-blue)' };
		if (entropy < 120) return { label: 'Strong', color: 'var(--accent-green)' };
		return { label: 'Very Strong', color: 'var(--accent-green)' };
	});

	let maxCombinations = $derived.by(() => {
		if (mode === 'uuid') return Infinity;
		const poolSize = availableChars.length;
		if (poolSize === 0) return 0;
		// Cap to avoid Infinity for large lengths
		if (length > 52) return Infinity;
		return Math.pow(poolSize, length);
	});

	// Generate on load
	if (browser) {
		generate();
	}

	function buildCharToggles() {
		const toggles = {};
		for (const [group, chars] of Object.entries(CHARSETS)) {
			for (const ch of chars) {
				toggles[ch] = { char: ch, group, enabled: isGroupEnabled(group) };
			}
		}
		return toggles;
	}

	function isGroupEnabled(group) {
		if (group === 'lowercase') return useLowercase;
		if (group === 'uppercase') return useUppercase;
		if (group === 'numbers') return useNumbers;
		if (group === 'symbols') return useSymbols;
		return false;
	}

	function syncTogglesToGroups() {
		for (const [ch, toggle] of Object.entries(charToggles)) {
			toggle.enabled = isGroupEnabled(toggle.group) && !excludeChars.includes(ch);
		}
		charToggles = { ...charToggles };
	}

	function toggleGroup(group, enabled) {
		if (group === 'lowercase') useLowercase = enabled;
		if (group === 'uppercase') useUppercase = enabled;
		if (group === 'numbers') useNumbers = enabled;
		if (group === 'symbols') useSymbols = enabled;
		syncTogglesToGroups();
	}

	function toggleChar(ch) {
		charToggles[ch].enabled = !charToggles[ch].enabled;
		charToggles = { ...charToggles };

		// Update group toggle if all chars in group are off/on
		const group = charToggles[ch].group;
		const groupChars = Object.values(charToggles).filter((t) => t.group === group);
		const allOff = groupChars.every((t) => !t.enabled);
		const allOn = groupChars.every((t) => t.enabled);
		if (group === 'lowercase') useLowercase = !allOff;
		if (group === 'uppercase') useUppercase = !allOff;
		if (group === 'numbers') useNumbers = !allOff;
		if (group === 'symbols') useSymbols = !allOff;
	}

	function handleExcludeInput() {
		syncTogglesToGroups();
	}

	function generatePassword() {
		const pool = availableChars;
		if (!pool.length) return '';

		// Find which groups are active (have at least 1 enabled char)
		const activeGroups = Object.entries(CHARSETS)
			.map(([group, chars]) => ({
				group,
				chars: chars.split('').filter((ch) => charToggles[ch]?.enabled)
			}))
			.filter((g) => g.chars.length > 0);

		// Not enough length to satisfy all groups
		if (length < activeGroups.length) {
			const arr = new Uint32Array(length);
			crypto.getRandomValues(arr);
			return Array.from(arr, (n) => pool[n % pool.length]).join('');
		}

		// Generate random password
		const arr = new Uint32Array(length);
		crypto.getRandomValues(arr);
		const result = Array.from(arr, (n) => pool[n % pool.length]);

		// Ensure at least 1 char from each active group
		const extraRand = new Uint32Array(activeGroups.length * 2);
		crypto.getRandomValues(extraRand);

		const usedPositions = new Set();
		let randIdx = 0;

		for (const { chars } of activeGroups) {
			const hasGroup = result.some((ch) => chars.includes(ch));
			if (!hasGroup) {
				// Pick a random position not already forced
				let pos;
				do {
					pos = extraRand[randIdx++] % length;
					if (randIdx >= extraRand.length) {
						const more = new Uint32Array(16);
						crypto.getRandomValues(more);
						extraRand.set?.(more) || (randIdx = 0);
					}
				} while (usedPositions.has(pos));
				usedPositions.add(pos);

				// Replace with a random char from the missing group
				result[pos] = chars[extraRand[randIdx++] % chars.length];
			}
		}

		return result.join('');
	}

	function generateUUID() {
		// RFC 4122 v4
		const bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
		bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
		const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
	}

	function generate() {
		if (mode === 'uuid') {
			const set = new Set();
			while (set.size < count) {
				set.add(generateUUID());
			}
			results = [...set];
		} else {
			if (!availableChars.length) {
				results = [];
				return;
			}
			const target = Math.min(count, maxCombinations);
			const set = new Set();
			const maxAttempts = target * 100;
			let attempts = 0;
			while (set.size < target && attempts < maxAttempts) {
				set.add(generatePassword());
				attempts++;
			}
			results = [...set];
		}
		copied = {};
	}

	async function copyValue(index) {
		try {
			await navigator.clipboard.writeText(results[index]);
			copied = { ...copied, [index]: true };
			setTimeout(() => {
				copied = { ...copied, [index]: false };
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	async function copyAll() {
		try {
			await navigator.clipboard.writeText(results.join('\n'));
			copied = { ...copied, all: true };
			setTimeout(() => {
				copied = { ...copied, all: false };
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	function charClass(ch) {
		if (/[a-z]/.test(ch)) return 'ch-lower';
		if (/[A-Z]/.test(ch)) return 'ch-upper';
		if (/[0-9]/.test(ch)) return 'ch-num';
		return 'ch-sym';
	}
</script>

<svelte:head>
	<title>Password & UUID Generator - DevTools</title>
</svelte:head>

<article class="post">
	<header class="post-header">
		<h1>Password & UUID</h1>
		<span class="post-date"
			>Cryptographically <span class="accent-green">secure</span>.
			<span class="accent-red">Don't use "password123"</span>.</span
		>
	</header>

	<p>
		Generate high-entropy passwords with fine-grained character control, or UUID v4 identifiers. All
		randomness from <code>crypto.getRandomValues</code>.
	</p>

	<!-- Mode Toggle -->
	<div class="mode-tabs">
		<button
			class="mode-tab"
			class:mode-tab-active={mode === 'password'}
			onclick={() => {
				mode = 'password';
				results = [];
			}}
		>
			Password
		</button>
		<button
			class="mode-tab"
			class:mode-tab-active={mode === 'uuid'}
			onclick={() => {
				mode = 'uuid';
				results = [];
			}}
		>
			UUID v4
		</button>
	</div>

	{#if mode === 'password'}
		<div class="settings-row">
			<!-- Length -->
			<div class="setting-item">
				<label for="pw-length">Length</label>
				<div class="length-control">
					<input
						id="pw-length"
						type="range"
						min="4"
						max="128"
						bind:value={length}
						class="length-slider"
					/>
					<input type="number" min="4" max="128" bind:value={length} class="length-num" />
				</div>
			</div>
			<!-- Count -->
			<div class="setting-item">
				<label for="pw-count">Count</label>
				<input type="number" min="1" bind:value={count} class="length-num" />
			</div>
			<!-- Character Groups -->
			<div class="setting-item">
				<label for="include-characters">Include characters</label>
				<div>
					<label class="charset-toggle">
						<input
							type="checkbox"
							bind:checked={useLowercase}
							onchange={() => {
								syncTogglesToGroups();
							}}
						/>
						<span>a-z</span>
					</label>
					<label class="charset-toggle">
						<input
							type="checkbox"
							bind:checked={useUppercase}
							onchange={() => {
								syncTogglesToGroups();
							}}
						/>
						<span>A-Z</span>
					</label>
					<label class="charset-toggle">
						<input
							type="checkbox"
							bind:checked={useNumbers}
							onchange={() => {
								syncTogglesToGroups();
							}}
						/>
						<span>0-9</span>
					</label>
					<label class="charset-toggle">
						<input
							type="checkbox"
							bind:checked={useSymbols}
							onchange={() => {
								syncTogglesToGroups();
							}}
						/>
						<span>!@#$</span>
					</label>
				</div>
			</div>
			<!-- Exclude -->
			<div class="setting-item">
				<label for="exclude-characters">Exclude characters</label>
				<input
					id="exclude-chars"
					type="text"
					bind:value={excludeChars}
					oninput={handleExcludeInput}
					placeholder="e.g. 0OlI1"
				/>
			</div>
			<div class="charset-toggles">
				<button class="text-btn" onclick={() => (showCharMap = !showCharMap)}>
					{showCharMap ? 'Hide' : 'Show'} character map
				</button>
			</div>
		</div>
		<!-- Character Map -->
		{#if showCharMap}
			<div class="charmap-section">
				{#each Object.entries(CHARSETS) as [group, chars]}
					<div class="charmap-group">
						<span class="charmap-label">{group}</span>
						<div class="charmap-grid">
							{#each chars.split('') as ch}
								<button
									class="charmap-char"
									class:charmap-off={!charToggles[ch]?.enabled}
									onclick={() => {
										toggleChar(ch);
									}}
									title={charToggles[ch]?.enabled ? `Exclude '${ch}'` : `Include '${ch}'`}
								>
									{ch}
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<!-- UUID count -->
		<div class="settings-row">
			<div class="setting-item">
				<label for="uuid-count">Count</label>
				<input type="number" min="1" bind:value={count} class="length-num" />
			</div>
		</div>
	{/if}

	{#if mode === 'password' && count > maxCombinations}
		<div class="warn-box">
			<span class="warn-icon">⚠</span>
			Only {maxCombinations.toLocaleString()} unique combination{maxCombinations === 1 ? '' : 's'} possible
			with {availableChars.length} characters at length {length}. Increase length or add more
			characters.
		</div>
	{/if}

	<!-- Generate Button -->
	<div class="controls-wrapper">
		<div class="controls-row">
			<button class="btn-primary" onclick={generate}>
				Generate{count > 1 ? ` (${count})` : ''}
			</button>
		</div>
	</div>

	<!-- Strength -->
	{#if results.length > 0}
		<div class="strength-bar">
			<span class="strength-label">Strength</span>
			<span class="strength-value" style:color={strength.color}>{strength.label}</span>
			<span class="strength-bits">{entropy} bits</span>
			{#if mode === 'password'}
				<span class="stats-sep">·</span>
				<span class="strength-bits">{availableChars.length} chars in pool</span>
			{/if}
		</div>
	{/if}

	<!-- Results -->
	{#if results.length > 0}
		<div class="input-group">
			<div class="label-row">
				<label>Result{results.length > 1 ? 's' : ''}</label>
				{#if results.length}
					<button class="copy-btn" onclick={copyAll}>
						{copied.all ? 'Copied All!' : 'Copy All'}
					</button>
				{/if}
			</div>
			<div class="result-card">
				{#each results as result, i}
					<div class="result-row">
						<span class="result-index">{i + 1}</span>
						<div class="result-value-row">
							<span class="result-value">
								{#if mode === 'password'}
									{#each result.split('') as ch}<span class={charClass(ch)}>{ch}</span>{/each}
								{:else}
									{result}
								{/if}
							</span>
							<button class="copy-btn" onclick={() => copyValue(i)}>
								{copied[i] ? 'Copied!' : 'Copy'}
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if mode === 'password' && !availableChars.length}
		<div class="error-box">
			<span class="error-icon">!</span>
			No characters selected. Enable at least one character group.
		</div>
	{/if}
</article>

<style>
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
		font-size: 0.85rem;
		padding: 0.5rem 1.25rem;
		cursor: pointer;
		transition: all 0.15s;
		text-transform: uppercase;
		letter-spacing: 0.04em;
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

	/* --- Length Control --- */
	.length-control {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.length-slider {
		flex: 1;
		min-width: 100px;
		accent-color: var(--fg);
		cursor: pointer;
		height: 4px;
	}

	.length-num {
		width: 4.5rem;
		padding: 0.4rem;
		font-size: 0.85rem;
		text-align: center;
		background-color: var(--bg);
	}

	/* --- Charset Toggles --- */
	.charset-row {
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.charset-toggles {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.charset-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
		text-transform: none;
		letter-spacing: 0;
		color: var(--fg);
		transition: border-color 0.15s;
		margin-bottom: 0;
	}

	.charset-toggle:hover {
		border-color: var(--gray);
	}

	.charset-toggle input[type='checkbox'] {
		width: auto;
		margin: 0;
		accent-color: var(--fg);
		cursor: pointer;
	}

	/* --- Character Map --- */
	.charmap-section {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1rem;
		margin-bottom: 1.5rem;
		background: rgba(128, 128, 128, 0.03);
	}

	.charmap-group {
		margin-bottom: 0.75rem;
	}

	.charmap-group:last-child {
		margin-bottom: 0;
	}

	.charmap-label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--gray);
		margin-bottom: 0.35rem;
		opacity: 0.7;
	}

	.charmap-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}

	.charmap-char {
		width: 2rem;
		height: 2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: transparent;
		color: var(--fg);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.1s;
	}

	.charmap-char:hover {
		border-color: var(--gray);
	}

	.charmap-char.charmap-off {
		opacity: 0.2;
		text-decoration: line-through;
	}

	.charmap-char.charmap-off:hover {
		opacity: 0.5;
	}

	/* --- Strength --- */
	.strength-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--gray);
		margin-bottom: 1.5rem;
	}

	.strength-label {
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.6;
		font-size: 0.7rem;
	}

	.strength-value {
		font-weight: 700;
		font-size: 0.8rem;
	}

	.strength-bits {
		opacity: 0.6;
	}

	/* --- Results --- */
	.result-card {
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}

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
		font-variant-numeric: tabular-nums;
		line-height: 1.5;
	}

	/* Colored characters in password */
	.ch-lower {
		color: var(--fg);
	}

	.ch-upper {
		color: var(--accent-blue);
	}

	.ch-num {
		color: var(--accent-gold);
	}

	.ch-sym {
		color: var(--accent-red);
	}

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

	/* --- Error --- */
	.error-box {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		margin-bottom: 1.5rem;
		border: 1px solid var(--accent-red);
		border-radius: 6px;
		color: var(--accent-red);
		font-family: var(--font-mono);
		font-size: 0.85rem;
		background: rgba(255, 77, 77, 0.05);
	}

	.error-icon {
		font-weight: bold;
		font-size: 1.1rem;
	}

	code {
		font-family: var(--font-mono);
		font-size: 0.85em;
		padding: 0.15em 0.35em;
		border-radius: 3px;
		background: rgba(128, 128, 128, 0.1);
	}

	.warn-box {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		margin-top: 0.75rem;
		border: 1px solid var(--accent-gold);
		border-radius: 6px;
		color: var(--accent-gold);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		background: rgba(251, 191, 36, 0.05);
	}

	.warn-icon {
		font-size: 1.1rem;
		flex-shrink: 0;
	}
</style>
