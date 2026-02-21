<!-- src/routes/+page.svelte -->
<main>
	<article class="post">
		<header class="post-header">
			<h1>Developer Utilities</h1>
			<span class="post-date"
				>Instruments for the <span class="accent-gold">local environment</span>.</span
			>
		</header>

		<p>
			A collection of stateless, client-side tools. No data leaves your browser. Because pasting
			your JWTs into random websites is a <span class="tooltip">bad idea</span>.
		</p>

		<div class="tools-grid">
			<a href="/epoch" class="tool-card">
				<div class="tool-header">
					<span class="tool-icon">1970</span>
					<span class="tool-arrow">→</span>
				</div>
				<h3>Epoch Converter</h3>
				<p>Human-readable timestamps from integer seconds. Time is an illusion.</p>
			</a>

			<a href="/formatter" class="tool-card">
				<div class="tool-header">
					<span class="tool-icon accent-gold">{'{ }'}</span>
					<span class="tool-arrow">→</span>
				</div>
				<h3>Code Formatter</h3>
				<p>Format, validate, and syntax-highlight JSON, HTML, CSS, JavaScript, etc.</p>
			</a>

			<a href="/diff" class="tool-card">
				<div class="tool-header">
					<span class="tool-icon accent-red">!=</span>
					<span class="tool-arrow">→</span>
				</div>
				<h3>Text Comparison</h3>
				<p>
					Find the difference. Semantic <span class="accent-red">deletions</span> and
					<span class="accent-green">additions</span> highlighted.
				</p>
			</a>

			<a href="/password" class="tool-card">
				<div class="tool-header">
					<span class="tool-icon accent-blue">***</span>
					<span class="tool-arrow">→</span>
				</div>
				<h3>Password & UUID</h3>
				<p>High entropy passwords with fine-grained character control. UUIDs too.</p>
			</a>

			<a href="/regex" class="tool-card">
				<div class="tool-header">
					<span class="tool-icon accent-green">/.*/</span>
					<span class="tool-arrow">→</span>
				</div>
				<h3>Regex Builder</h3>
				<p>Test patterns against strings. Live matches and capture groups highlighted.</p>
			</a>
		</div>

		<div class="calibrating-box" style="margin-top: 3rem;">More modules compiling...</div>
	</article>
</main>

<style>
	.post-header {
		margin-bottom: 2rem;
	}
	.post-date {
		font-size: 0.9rem;
		color: var(--gray);
	}

	.tools-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 2rem;
	}

	@media (max-width: 600px) {
		.tools-grid {
			grid-template-columns: 1fr;
		}
	}

	.tool-card {
		display: block;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1.5rem;
		transition: all 0.2s ease;
		text-decoration: none;
		background: transparent;
		color: var(--fg);
	}

	.tool-card:hover {
		border-color: var(--gray);
		transform: translateY(-2px);
		background: rgba(128, 128, 128, 0.03);
	}

	.tool-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 1rem;
		font-size: 1.2rem;
		font-weight: bold;
	}

	.tool-arrow {
		opacity: 0;
		transition:
			opacity 0.2s,
			transform 0.2s;
	}

	.tool-card:hover .tool-arrow {
		opacity: 1;
		transform: translateX(4px);
	}

	.tool-card p {
		font-size: 0.85rem;
		color: var(--gray);
		margin-bottom: 0;
		line-height: 1.5;
	}
</style>
