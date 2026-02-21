<!-- src/routes/epoch/+page.svelte -->
<script>
	import { onMount } from 'svelte';
	import AlertBox from '$lib/components/AlertBox.svelte';

	const DISCORD_EPOCH = 1420070400000;

	let epochInput = $state('');
	let datePickerValue = $state('');
	let nowMs = $state(Date.now());
	let copied = $state({});
	let selectedUnit = $state('milliseconds');
	let dateZone = $state('local');

	useNow();

	onMount(() => {
		let frame;
		function tick() {
			nowMs = Date.now();
			frame = requestAnimationFrame(tick);
		}
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function toDatetimeLocal(d) {
		if (dateZone === 'gmt') {
			return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
		}
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	}

	function pickerToDate(value) {
		if (!value) return null;
		if (dateZone === 'gmt') {
			const [datePart, timePart] = value.split('T');
			const [y, mo, d] = datePart.split('-').map(Number);
			const [h, mi, s] = (timePart || '00:00:00').split(':').map(Number);
			return new Date(Date.UTC(y, mo - 1, d, h, mi, s || 0));
		}
		return new Date(value);
	}

	function relativeTime(date, now) {
		const diff = now - date.getTime();
		const abs = Math.abs(diff);
		const future = diff < 0;
		const pre = future ? 'in ' : '';
		const suf = future ? '' : ' ago';
		if (abs < 1000) return 'just now';
		if (abs < 60_000) return `${pre}${Math.floor(abs / 1000)}s${suf}`;
		if (abs < 3_600_000) return `${pre}${Math.floor(abs / 60_000)}m${suf}`;
		if (abs < 86_400_000) return `${pre}${Math.floor(abs / 3_600_000)}h${suf}`;
		if (abs < 31_536_000_000) return `${pre}${Math.floor(abs / 86_400_000)}d${suf}`;
		return `${pre}${Math.floor(abs / 31_536_000_000)}y${suf}`;
	}

	function rawToMs(raw) {
		const trimmed = raw.trim();
		if (!trimmed) return NaN;
		if (selectedUnit === 'discordSnowflake') {
			try {
				return Number(BigInt(trimmed) >> 22n) + DISCORD_EPOCH;
			} catch {
				return NaN;
			}
		}
		const num = Number(trimmed);
		if (!Number.isFinite(num)) return NaN;
		return selectedUnit === 'milliseconds' ? num : num * 1000;
	}

	function msToInput(ms) {
		if (selectedUnit === 'discordSnowflake') {
			const snowflake = (BigInt(ms) - BigInt(DISCORD_EPOCH)) << 22n;
			return String(snowflake < 0n ? 0n : snowflake);
		}
		if (selectedUnit === 'milliseconds') return String(ms);
		return String(Math.floor(ms / 1000));
	}

	function detectUnit(raw) {
		const trimmed = raw.trim();
		if (!trimmed) return selectedUnit;
		const num = Number(trimmed);
		if (!Number.isFinite(num)) return selectedUnit;
		const abs = Math.abs(num);
		if (num > 0 && abs > 1e15) {
			try {
				const ms = Number(BigInt(trimmed) >> 22n) + DISCORD_EPOCH;
				const year = new Date(ms).getFullYear();
				if (year >= 2015 && year <= 2100) return 'discordSnowflake';
			} catch {
				/* fall through */
			}
		}
		return abs > 1e11 ? 'milliseconds' : 'seconds';
	}

	function handleEpochInput() {
		const raw = epochInput.trim();
		if (!raw) {
			datePickerValue = '';
			return;
		}
		selectedUnit = detectUnit(raw);
		const ms = rawToMs(raw);
		if (isNaN(ms)) return;
		const d = new Date(ms);
		if (isNaN(d.getTime())) return;
		datePickerValue = toDatetimeLocal(d);
	}

	function handleUnitChange() {
		const raw = epochInput.trim();
		if (!raw) return;
		const ms = rawToMs(raw);
		if (isNaN(ms)) return;
		const d = new Date(ms);
		if (isNaN(d.getTime())) return;
		datePickerValue = toDatetimeLocal(d);
	}

	function handlePickerInput() {
		const d = pickerToDate(datePickerValue);
		if (!d || isNaN(d.getTime())) return;
		epochInput = msToInput(d.getTime());
	}

	function handleZoneChange() {
		handlePickerInput();
	}

	function useNow() {
		selectedUnit = 'milliseconds';
		epochInput = String(Date.now());
		const d = new Date(Number(epochInput));
		datePickerValue = toDatetimeLocal(d);
	}

	let result = $derived.by(() => {
		const empty = {
			utc: null,
			iso: null,
			local: null,
			seconds: null,
			milliseconds: null
		};
		const raw = epochInput.trim();
		if (!raw) return empty;
		const ms = rawToMs(raw);
		if (isNaN(ms)) return { ...empty, error: 'Not a valid number' };
		const d = new Date(ms);
		if (isNaN(d.getTime())) return { ...empty, error: 'Invalid timestamp' };
		const msVal = d.getTime();
		return {
			date: d,
			utc: d.toUTCString(),
			iso: d.toISOString(),
			local: d.toString(),
			seconds: Math.floor(msVal / 1000),
			milliseconds: msVal
		};
	});

	let relative = $derived.by(() => {
		if (!result?.date || result.error) return null;
		return relativeTime(result.date, nowMs);
	});

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
	<title>Epoch Converter - DevTools</title>
</svelte:head>

<article class="post">
	<header class="post-header">
		<h1>Epoch Converter</h1>
		<span class="post-date"
			>Human-readable timestamps. <span class="accent-gold">Time is an illusion.</span></span
		>
	</header>

	<p>
		Convert between Unix timestamps and human dates. Auto-detects seconds, milliseconds, and Discord
		snowflakes.
	</p>

	<!-- Live Clock -->
	<div class="now-bar">
		<button class="now-stamp" onclick={useNow} title="Use current timestamp">
			{nowMs}
		</button>
	</div>

	<!-- Converter Grid -->
	<div class="converter-grid">
		<div class="converter-pane">
			<div class="input-group">
				<div class="label-row">
					<label for="epoch-input">Epoch</label>
				</div>
				<input
					id="epoch-input"
					type="text"
					bind:value={epochInput}
					oninput={handleEpochInput}
					placeholder="1700000000"
					inputmode="numeric"
				/>
				<div class="unit-bar">
					<select class="unit-select" bind:value={selectedUnit} onchange={handleUnitChange}>
						<option value="seconds">Seconds</option>
						<option value="milliseconds">Milliseconds</option>
						<option value="discordSnowflake">Discord Snowflake</option>
					</select>
				</div>
			</div>
		</div>

		<div class="converter-pane">
			<div class="input-group">
				<div class="label-row">
					<label for="date-input">Date</label>
				</div>
				<input
					type="datetime-local"
					class="datetime-picker"
					bind:value={datePickerValue}
					oninput={handlePickerInput}
					step="1"
					aria-label="Date picker"
				/>
				<div class="unit-bar">
					<select class="unit-select" bind:value={dateZone} onchange={handleZoneChange}>
						<option value="local">Local</option>
						<option value="gmt">GMT</option>
					</select>
				</div>
			</div>
		</div>
	</div>

	{#if result?.error}
		<AlertBox type="error">{result.error}</AlertBox>
	{/if}

	<div class="input-group">
		<div class="label-row">
			<label>Result</label>
		</div>
		<div class="result-card">
			{#each [...Object.entries(result || {}).filter(([k]) => k !== 'date' && k !== 'error'), ['relative', relative]] as [key, value]}
				<div class="result-row">
					<span class="result-label">{key}</span>
					<div class="result-value-row">
						{#if value != null && !result.error}
							<span class="result-value">{value}</span>
							<button class="copy-btn" onclick={() => copyValue(key, String(value))}>
								{copied[key] ? 'Copied!' : 'Copy'}
							</button>
						{:else}
							<span class="result-label result-value">-</span>
							<button class="result-label copy-btn">{' '}</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</article>

<style>
	/* --- Live Clock --- */
	.now-bar {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.6rem;
		padding: 1.25rem 1rem;
		margin-bottom: 1.5rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: rgba(128, 128, 128, 0.03);
		font-variant-numeric: tabular-nums;
	}

	.now-stamp {
		background: none;
		border: none;
		color: var(--accent-gold);
		font-family: var(--font-mono);
		font-size: 1.4rem;
		font-weight: 700;
		cursor: pointer;
		padding: 0;
		border-bottom: 1px dashed var(--accent-gold);
		transition: opacity 0.2s;
		font-variant-numeric: tabular-nums;
	}

	.now-stamp:hover {
		opacity: 0.7;
	}

	/* --- Converter Grid --- */
	.converter-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 640px) {
		.converter-grid {
			grid-template-columns: 1fr;
		}
	}

	.converter-pane .input-group {
		margin-bottom: 0;
	}

	/* --- Unit / Zone Select --- */
	.unit-bar {
		margin-top: 0.4rem;
	}

	.unit-select {
		background-color: var(--bg);
		border: 1px solid var(--border);
		color: var(--gray);
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		cursor: pointer;
		transition: border-color 0.2s;
		width: auto;
	}

	.unit-select:focus {
		outline: none;
		border-color: var(--accent-gold);
	}

	.unit-select:hover {
		border-color: var(--gray);
	}

	/* --- Datetime Picker --- */
	.datetime-picker {
		width: 100%;
		background: transparent;
		border: 1px solid var(--border);
		color: var(--fg);
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		transition: border-color 0.2s;
	}

	.datetime-picker:focus {
		outline: none;
		border-color: var(--accent-gold);
	}

	@media (prefers-color-scheme: dark) {
		:global(html:not([data-theme])) .datetime-picker,
		:global(html[data-theme='system']) .datetime-picker {
			color-scheme: dark;
		}
	}

	:global(html[data-theme='dark']) .datetime-picker {
		color-scheme: dark;
	}

	/* --- Result Card --- */
	.result-card {
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}

	.result-row {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.65rem 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.result-row:last-child {
		border-bottom: none;
	}

	.result-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--gray);
		opacity: 0.7;
	}

	.result-value {
		font-size: 0.85rem;
		word-break: break-all;
		font-variant-numeric: tabular-nums;
	}

	.result-value-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
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
	}

	.copy-btn:hover {
		color: var(--fg);
	}
</style>
