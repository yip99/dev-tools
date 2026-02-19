<!-- src/lib/components/CodeEditor.svelte -->
<script>
	import { tick } from 'svelte';

	let {
		value = $bindable(''),
		id = undefined,
		readonly = false,
		placeholder = '',
		rows = 8,
		error = false,
		wrap = false,
		diffMarkers = undefined,
		diffSegments = undefined
	} = $props();

	let gutterEl = $state(null);
	let textareaEl = $state(null);
	let mirrorEl = $state(null);
	let diffLayerEl = $state(null);
	let overlayEl = $state(null);
	let scrollbarH = $state(0);
	let scrollbarW = $state(0);
	let lineHeights = $state([]);
	let focused = $state(false);
	let activeLine = $state(-1);
	let scrollTop = $state(0);

	const LINE_H = 20;

	let lineCount = $derived(Math.max((value ?? '').split('\n').length, rows));
	let lineTexts = $derived((value ?? '').split('\n'));
	let paddedTexts = $derived([
		...lineTexts,
		...Array(Math.max(0, rows - lineTexts.length)).fill('')
	]);
	let lines = $derived(Array.from({ length: lineCount }, (_, i) => i + 1));
	let digits = $derived(Math.max(2, String(lineCount).length));
	let hasDiff = $derived(Array.isArray(diffMarkers) && diffMarkers.length > 0);

	let highlightStyle = $derived.by(() => {
		if (activeLine < 0 || !focused || readonly || hasDiff) return null;

		let top = 0;
		let height = LINE_H;

		if (wrap && lineHeights.length > activeLine) {
			for (let i = 0; i < activeLine; i++) {
				top += lineHeights[i] || LINE_H;
			}
			height = lineHeights[activeLine] || LINE_H;
		} else {
			top = activeLine * LINE_H;
		}

		top -= scrollTop;
		return `top:calc(var(--pad-y) + ${top}px);height:${height}px`;
	});

	$effect(() => {
		if (!textareaEl) return;
		function measure() {
			scrollbarH = textareaEl.offsetHeight - textareaEl.clientHeight;
			scrollbarW = textareaEl.offsetWidth - textareaEl.clientWidth;
		}
		const ro = new ResizeObserver(measure);
		ro.observe(textareaEl);
		return () => ro.disconnect();
	});

	$effect(() => {
		if (!wrap || !mirrorEl) {
			lineHeights = [];
			return;
		}
		void value;
		measureLineHeights();
	});

	$effect(() => {
		if (!wrap || !mirrorEl) return;
		const ro = new ResizeObserver(() => measureLineHeights());
		ro.observe(mirrorEl);
		return () => ro.disconnect();
	});

	function measureLineHeights() {
		if (!mirrorEl) return;
		const children = mirrorEl.children;
		const heights = [];
		for (let i = 0; i < children.length; i++) {
			heights.push(children[i].offsetHeight);
		}
		lineHeights = heights;
	}

	function updateActiveLine() {
		if (!textareaEl || readonly) {
			activeLine = -1;
			return;
		}
		const pos = textareaEl.selectionStart;
		const before = (value ?? '').slice(0, pos);
		activeLine = before.split('\n').length - 1;
		scrollTop = textareaEl.scrollTop;
	}

	function handleFocus() {
		focused = true;
		updateActiveLine();
	}

	function handleBlur() {
		focused = false;
		activeLine = -1;
	}

	function syncScroll() {
		if (!textareaEl) return;
		const top = textareaEl.scrollTop;
		const left = textareaEl.scrollLeft;
		if (gutterEl) gutterEl.scrollTop = top;
		if (diffLayerEl) diffLayerEl.scrollTop = top;
		if (overlayEl) {
			overlayEl.scrollTop = top;
			overlayEl.scrollLeft = left;
		}
		scrollTop = top;
		scrollbarH = textareaEl.offsetHeight - textareaEl.clientHeight;
	}

	async function handleKeydown(e) {
		if (readonly || e.key !== 'Tab') return;
		e.preventDefault();

		const ta = e.target;
		const start = ta.selectionStart;
		const end = ta.selectionEnd;

		if (e.shiftKey) {
			const lineStart = value.lastIndexOf('\n', start - 1) + 1;
			const match = value.slice(lineStart).match(/^ {1,2}/);
			if (match) {
				const len = match[0].length;
				value = value.slice(0, lineStart) + value.slice(lineStart + len);
				await tick();
				ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start - len);
			}
		} else {
			value = value.slice(0, start) + '  ' + value.slice(end);
			await tick();
			ta.selectionStart = ta.selectionEnd = start + 2;
		}

		updateActiveLine();
	}

	function diffAt(i) {
		return diffMarkers?.[i] ?? null;
	}
</script>

<div
	class="editor"
	class:has-error={error}
	class:is-readonly={readonly}
	class:is-wrap={wrap}
	class:is-diff={hasDiff}
	style:--digits={digits}
>
	{#if hasDiff}
		<div
			class="diff-layer"
			bind:this={diffLayerEl}
			aria-hidden="true"
			style:bottom="{scrollbarH}px"
		>
			{#each lines as _, i}
				<div
					class="diff-ln"
					class:diff-added={diffAt(i) === 'added'}
					class:diff-removed={diffAt(i) === 'removed'}
					class:diff-modified={diffAt(i) === 'modified'}
					style:height={wrap && lineHeights[i] ? `${lineHeights[i]}px` : null}
				></div>
			{/each}
		</div>
	{/if}

	{#if highlightStyle}
		<div class="line-highlight" style={highlightStyle}></div>
	{/if}

	{#if hasDiff}
		<div
			class="text-overlay"
			bind:this={overlayEl}
			aria-hidden="true"
			style:bottom="{scrollbarH}px"
			style:right="{scrollbarW}px"
		>
			{#each lines as _, i}
				<div
					class="overlay-line"
					class:overlay-removed={diffAt(i) === 'removed'}
					style:height={wrap && lineHeights[i] ? `${lineHeights[i]}px` : null}
				>
					{#if diffSegments?.[i]}
						{#each diffSegments[i] as seg}
							{#if seg.type === 'char-added'}
								<span class="seg-added">{seg.text}</span>
							{:else if seg.type === 'char-removed'}
								<span class="seg-removed">{seg.text}</span>
							{:else}
								<span>{seg.text}</span>
							{/if}
						{/each}
					{:else}
						{lineTexts[i] ?? ''}
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<div class="gutter" bind:this={gutterEl} aria-hidden="true" style:bottom="{scrollbarH}px">
		{#each lines as n, i}
			<div
				class="ln"
				class:ln-active={focused && !readonly && activeLine === i}
				class:ln-diff-added={diffAt(i) === 'added'}
				class:ln-diff-removed={diffAt(i) === 'removed'}
				class:ln-diff-modified={diffAt(i) === 'modified'}
				style:height={wrap && lineHeights[i] ? `${lineHeights[i]}px` : null}
			>
				{n}
			</div>
		{/each}
	</div>

	{#if wrap}
		<div class="mirror" bind:this={mirrorEl} aria-hidden="true" style:right="{scrollbarW}px">
			{#each paddedTexts as text}
				<div class="mirror-line">{text || '\u200b'}</div>
			{/each}
		</div>
	{/if}

	<textarea
		{id}
		bind:this={textareaEl}
		bind:value
		{readonly}
		{placeholder}
		{rows}
		onscroll={syncScroll}
		onkeydown={handleKeydown}
		onkeyup={updateActiveLine}
		onmouseup={updateActiveLine}
		onfocus={handleFocus}
		onblur={handleBlur}
		oninput={updateActiveLine}
		spellcheck="false"
		autocomplete="off"
		autocorrect="off"
		autocapitalize="off"
		wrap={wrap ? 'soft' : 'off'}
	></textarea>
</div>

<style>
	.editor {
		position: relative;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		--line-h: 20px;
		--pad-y: 0.75rem;
		--gutter-w: calc(var(--digits) * 1ch + 1.25rem);
		line-height: var(--line-h);
	}

	.editor:focus-within {
		border-color: var(--accent-gold);
	}

	.editor.has-error {
		border-color: var(--accent-red);
	}

	/* ── Active line highlight ── */
	.line-highlight {
		position: absolute;
		left: 0;
		right: 0;
		background: rgba(128, 128, 128, 0.07);
		pointer-events: none;
		z-index: 0;
	}

	/* ── Diff layer ── */
	.diff-layer {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		padding: var(--pad-y) 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
	}

	.diff-ln {
		height: var(--line-h);
	}

	.diff-ln.diff-added {
		background: rgba(34, 197, 94, 0.1);
		border-left: 3px solid rgba(34, 197, 94, 0.45);
	}

	.diff-ln.diff-removed {
		background: rgba(239, 68, 68, 0.1);
		border-left: 3px solid rgba(239, 68, 68, 0.45);
	}

	.diff-ln.diff-modified {
		background: rgba(251, 191, 36, 0.1);
		border-left: 3px solid rgba(251, 191, 36, 0.45);
	}

	/* ── Text overlay ── */
	.text-overlay {
		position: absolute;
		top: 0;
		left: 0;
		padding: var(--pad-y) 0.75rem;
		padding-left: calc(var(--gutter-w) + 0.75rem);
		overflow: hidden;
		pointer-events: none;
		white-space: pre;
		color: var(--fg);
		font: inherit;
		line-height: var(--line-h);
		z-index: 1;
	}

	.is-wrap .text-overlay {
		white-space: pre-wrap;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.overlay-line {
		height: var(--line-h);
		line-height: var(--line-h);
	}

	.overlay-removed {
		text-decoration: line-through;
		opacity: 0.55;
	}

	.seg-added {
		background: rgba(34, 197, 94, 0.22);
		border-radius: 2px;
		padding: 1px 0;
	}

	.seg-removed {
		background: rgba(239, 68, 68, 0.18);
		text-decoration: line-through;
		opacity: 0.65;
		border-radius: 2px;
		padding: 1px 0;
	}

	/* ── Gutter (opaque background to prevent text bleed) ── */
	.gutter {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--gutter-w);
		padding: var(--pad-y) 0;
		overflow: hidden;
		pointer-events: none;
		border-right: 1px solid var(--border);
		background-color: var(--bg);
		background-image: linear-gradient(rgba(128, 128, 128, 0.04), rgba(128, 128, 128, 0.04));
		user-select: none;
		z-index: 3;
	}

	.is-diff .gutter {
		background-image: linear-gradient(rgba(128, 128, 128, 0.02), rgba(128, 128, 128, 0.02));
	}

	.ln {
		height: var(--line-h);
		line-height: var(--line-h);
		text-align: right;
		padding: 0 0.5rem;
		color: var(--gray);
		opacity: 0.4;
		transition:
			opacity 0.15s,
			color 0.15s;
	}

	.ln-active {
		opacity: 1;
		color: var(--fg);
	}

	.ln-diff-added {
		color: var(--accent-green);
		opacity: 0.75;
	}

	.ln-diff-removed {
		color: var(--accent-red);
		opacity: 0.6;
		text-decoration: line-through;
	}

	.ln-diff-modified {
		color: var(--accent-gold);
		opacity: 0.75;
	}

	/* ── Mirror ── */
	.mirror {
		position: absolute;
		top: 0;
		left: 0;
		visibility: hidden;
		pointer-events: none;
		padding: var(--pad-y);
		padding-left: calc(var(--gutter-w) + 0.75rem);
		font: inherit;
		line-height: var(--line-h);
		white-space: pre-wrap;
		word-wrap: break-word;
		overflow-wrap: break-word;
		overflow: hidden;
	}

	.mirror-line {
		line-height: var(--line-h);
	}

	/* ── Textarea ── */
	textarea {
		display: block;
		width: 100%;
		padding: var(--pad-y) 0.75rem;
		padding-left: calc(var(--gutter-w) + 0.75rem);
		background: transparent;
		border: none;
		color: var(--fg);
		font: inherit;
		line-height: var(--line-h);
		resize: vertical;
		white-space: pre;
		overflow-x: auto;
		tab-size: 2;
		position: relative;
		z-index: 2;
	}

	.is-wrap textarea {
		white-space: pre-wrap;
		word-wrap: break-word;
		overflow-wrap: break-word;
		overflow-x: hidden;
	}

	.is-diff textarea {
		color: transparent;
		caret-color: transparent;
	}

	.is-diff textarea::selection {
		background: rgba(128, 128, 128, 0.25);
	}

	textarea:focus {
		outline: none;
	}

	textarea::placeholder {
		color: var(--gray);
		opacity: 0.4;
	}

	/* ── Readonly ── */
	.is-readonly textarea {
		background: rgba(128, 128, 128, 0.03);
		cursor: default;
	}

	.is-readonly .gutter {
		background-image: linear-gradient(rgba(128, 128, 128, 0.06), rgba(128, 128, 128, 0.06));
	}

	.is-readonly.is-diff .gutter {
		background-image: linear-gradient(rgba(128, 128, 128, 0.03), rgba(128, 128, 128, 0.03));
	}
</style>
