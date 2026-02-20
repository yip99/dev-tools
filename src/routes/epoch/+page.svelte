<!-- src/routes/epoch/+page.svelte -->
<script>
	import { onMount } from 'svelte';
	import AlertBox from '$lib/components/AlertBox.svelte';

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

	function isMilliseconds(num) {
		return Math.abs(num) > 1e12;
	}

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
			// Parse as UTC
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

	function epochToMs(num) {
		return selectedUnit === 'milliseconds' ? num : num * 1000;
	}

	function handleEpochInput() {
		const raw = epochInput.trim();
		if (!raw) {
			datePickerValue = '';
			return;
		}
		const num = Number(raw);
		if (!Number.isFinite(num)) return;

		selectedUnit = isMilliseconds(num) ? 'milliseconds' : 'seconds';

		const ms = epochToMs(num);
		const d = new Date(ms);
		if (isNaN(d.getTime())) return;
		datePickerValue = toDatetimeLocal(d);
	}

	function handleUnitChange() {
		const raw = epochInput.trim();
		if (!raw) return;
		const num = Number(raw);
		if (!Number.isFinite(num)) return;
		const ms = epochToMs(num);
		const d = new Date(ms);
		if (isNaN(d.getTime())) return;
		datePickerValue = toDatetimeLocal(d);
	}

	function handlePickerInput() {
		const d = pickerToDate(datePickerValue);
		if (!d || isNaN(d.getTime())) return;
		if (selectedUnit === 'milliseconds') {
			epochInput = String(d.getTime());
		} else {
			epochInput = String(Math.floor(d.getTime() / 1000));
		}
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
		const raw = epochInput.trim();
		if (!raw) return null;
		const num = Number(raw);
		if (!Number.isFinite(num)) return { error: 'Not a valid number' };
		const ms = epochToMs(num);
		const d = new Date(ms);
		if (isNaN(d.getTime())) return { error: 'Invalid timestamp' };
		if (d.getFullYear() < 0 || d.getFullYear() > 9999) return { error: 'Out of range' };
		return {
			date: d,
			utc: d.toUTCString(),
			iso: d.toISOString(),
			local: d.toString(),
			seconds: Math.floor(d.getTime() / 1000),
			milliseconds: d.getTime()
		};
	});

	let relative = $derived.by(() => {
		if (!result || result.error) return null;
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

	<p>Convert between Unix timestamps and human dates. Auto-detects seconds vs milliseconds.</p>

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
				{#if epochInput.trim()}
					<div class="unit-bar">
						<select class="unit-select" bind:value={selectedUnit} onchange={handleUnitChange}>
							<option value="seconds">Seconds</option>
							<option value="milliseconds">Milliseconds</option>
						</select>
					</div>
				{/if}
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
		{result.error}
		<AlertBox type="error">{result.error}</AlertBox>
	{/if}

	{#if result && !result.error}
		<div class="input-group">
			<div class="label-row">
				<label>Result</label>
			</div>
			<div class="result-card">
				<div class="result-row">
					<span class="result-label">Local</span>
					<div class="result-value-row">
						<span class="result-value">{result.local}</span>
						<button class="copy-btn" onclick={() => copyValue('local', result.local)}>
							{copied.local ? 'Copied!' : 'Copy'}
						</button>
					</div>
				</div>
				<div class="result-row">
					<span class="result-label">UTC</span>
					<div class="result-value-row">
						<span class="result-value">{result.utc}</span>
						<button class="copy-btn" onclick={() => copyValue('utc', result.utc)}>
							{copied.utc ? 'Copied!' : 'Copy'}
						</button>
					</div>
				</div>
				<div class="result-row">
					<span class="result-label">ISO 8601</span>
					<div class="result-value-row">
						<span class="result-value">{result.iso}</span>
						<button class="copy-btn" onclick={() => copyValue('iso', result.iso)}>
							{copied.iso ? 'Copied!' : 'Copy'}
						</button>
					</div>
				</div>
				<div class="result-row">
					<span class="result-label">Milliseconds</span>
					<div class="result-value-row">
						<span class="result-value">{result.milliseconds}</span>
						<button class="copy-btn" onclick={() => copyValue('ms', String(result.milliseconds))}>
							{copied.ms ? 'Copied!' : 'Copy'}
						</button>
					</div>
				</div>
				<div class="result-row">
					<span class="result-label">Seconds</span>
					<div class="result-value-row">
						<span class="result-value">{result.seconds}</span>
						<button class="copy-btn" onclick={() => copyValue('sec', String(result.seconds))}>
							{copied.sec ? 'Copied!' : 'Copy'}
						</button>
					</div>
				</div>
				<div class="result-row">
					<span class="result-label">Relative</span>
					<div class="result-value-row">
						<span class="result-value accent-gold">{relative}</span>
						<button class="copy-btn" onclick={() => copyValue('relative', relative)}>
							{copied.relative ? 'Copied!' : 'Copy'}
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
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
