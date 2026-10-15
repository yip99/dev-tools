<script>
	import { onDestroy } from 'svelte';

	const ASPECT_RATIOS = [
		{ label: 'Free', value: 'free' },
		{ label: '1:1', value: '1:1' },
		{ label: '2:3', value: '2:3' },
		{ label: '3:2', value: '3:2' },
		{ label: '3:4', value: '3:4' },
		{ label: '4:3', value: '4:3' },
		{ label: '4:5', value: '4:5' },
		{ label: '5:4', value: '5:4' },
		{ label: '9:16', value: '9:16' },
		{ label: '16:9', value: '16:9' },
		{ label: '9:21', value: '9:21' },
		{ label: '21:9', value: '21:9' },
		{ label: 'Custom', value: 'custom' }
	];

	let imageUrl = $state('');
	let imageName = $state('image');
	let imageWidth = $state(0);
	let imageHeight = $state(0);
	let imageElement = $state();
	let imageFrame = $state();
	let fileInput = $state();
	let crop = $state({ x: 0, y: 0, width: 0, height: 0 });
	let cropMode = $state('free');
	let aspectChoice = $state('free');
	let customRatioWidth = $state('3');
	let customRatioHeight = $state('2');
	let dimensionWidth = $state('');
	let dimensionHeight = $state('');
	let outputWidth = $state('');
	let outputHeight = $state('');
	let outputScale = $state('');
	let outputResizeMode = $state('');
	let outputFormat = $state('image/png');
	let gridVisible = $state(true);
	let isDraggingOver = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let pointerAction = null;
	let pendingCrop = null;

	let cropStyle = $derived(
		imageWidth && imageHeight
			? `left:${(crop.x / imageWidth) * 100}%;top:${(crop.y / imageHeight) * 100}%;width:${(crop.width / imageWidth) * 100}%;height:${(crop.height / imageHeight) * 100}%`
			: ''
	);
	let currentAspectRatio = $derived.by(() => {
		const width = Math.round(crop.width);
		const height = Math.round(crop.height);
		if (!width || !height) return '';
		const divisor = greatestCommonDivisor(width, height);
		return `${width / divisor}:${height / divisor}`;
	});
	let cropCoordinates = $derived.by(() => {
		const left = Math.round(crop.x);
		const top = Math.round(crop.y);
		const width = Math.round(crop.width);
		const height = Math.round(crop.height);
		return {
			leftX: left,
			leftY: top,
			centerX: left + width / 2,
			centerY: top + height / 2
		};
	});
	let outputResizePreview = $derived.by(() => {
		if (!crop.width || !crop.height) {
			return { scale: '100', width: 'Width', height: 'Height', exportWidth: 0, exportHeight: 0 };
		}
		const cropWidth = Math.max(1, Math.round(crop.width));
		const cropHeight = Math.max(1, Math.round(crop.height));
		const ratio = crop.width / crop.height;
		if (!outputResizeMode) {
			return {
				scale: '100',
				width: 'Width',
				height: 'Height',
				exportWidth: cropWidth,
				exportHeight: cropHeight
			};
		}
		let width = cropWidth;
		let height = cropHeight;
		let scale = 100;

		if (outputResizeMode === 'scale') {
			scale = Math.min(100, Number(outputScale) || 100);
			width = Math.max(1, Math.round((crop.width * scale) / 100));
			height = Math.max(1, Math.round((crop.height * scale) / 100));
		} else if (outputResizeMode === 'width') {
			width = Math.min(cropWidth, Math.max(1, Number(outputWidth) || cropWidth));
			height = Math.min(cropHeight, Math.max(1, Math.round(width / ratio)));
			scale = Math.min(100, (width / crop.width) * 100);
		} else if (outputResizeMode === 'height') {
			height = Math.min(cropHeight, Math.max(1, Number(outputHeight) || cropHeight));
			width = Math.min(cropWidth, Math.max(1, Math.round(height * ratio)));
			scale = Math.min(100, (height / crop.height) * 100);
		}

		return {
			scale: outputResizeMode === 'scale' ? '' : String(Math.round(scale * 10) / 10),
			width: outputResizeMode === 'width' ? '' : String(width),
			height: outputResizeMode === 'height' ? '' : String(height),
			exportWidth: width,
			exportHeight: height
		};
	});

	function greatestCommonDivisor(a, b) {
		while (b) [a, b] = [b, a % b];
		return a;
	}

	function currentRatio() {
		if (cropMode === 'dimensions') {
			const width = Number(dimensionWidth);
			const height = Number(dimensionHeight);
			return width > 0 && height > 0 ? width / height : null;
		}
		if (cropMode !== 'ratio' || aspectChoice === 'free') return null;
		if (aspectChoice === 'custom') {
			const width = Number(customRatioWidth);
			const height = Number(customRatioHeight);
			return width > 0 && height > 0 ? width / height : null;
		}
		const [width, height] = aspectChoice.split(':').map(Number);
		return width / height;
	}

	function setMessage(message, isError = false) {
		errorMessage = isError ? message : '';
		successMessage = isError ? '' : message;
	}

	function loadImage(file) {
		if (!file || !file.type.startsWith('image/')) {
			setMessage('Choose an image file to continue.', true);
			return;
		}
		pendingCrop =
			imageWidth && imageHeight && crop.width && crop.height
				? {
						crop: { ...crop },
						width: imageWidth,
						height: imageHeight,
						mode: cropMode
					}
				: null;
		if (imageUrl) URL.revokeObjectURL(imageUrl);
		imageUrl = URL.createObjectURL(file);
		imageName = file.name.replace(/\.[^.]+$/, '') || 'image';
		imageWidth = 0;
		imageHeight = 0;
		crop = { x: 0, y: 0, width: 0, height: 0 };
		setMessage('');
	}

	function handleImageLoad(event) {
		const image = event.currentTarget;
		imageWidth = image.naturalWidth;
		imageHeight = image.naturalHeight;
		if (!pendingCrop) {
			crop = { x: 0, y: 0, width: imageWidth, height: imageHeight };
		} else {
			const previous = pendingCrop;
			const mappedX = (previous.crop.x / previous.width) * imageWidth;
			const mappedY = (previous.crop.y / previous.height) * imageHeight;
			if (previous.mode === 'ratio' || previous.mode === 'dimensions') {
				const ratio = currentRatio() || previous.crop.width / previous.crop.height;
				const scale = Math.min(imageWidth / previous.width, imageHeight / previous.height);
				const width = Math.min(previous.crop.width * scale, imageWidth, imageHeight * ratio);
				const height = width / ratio;
				crop = {
					x: Math.max(0, Math.min(imageWidth - width, mappedX)),
					y: Math.max(0, Math.min(imageHeight - height, mappedY)),
					width,
					height
				};
			} else {
				const width = Math.min((previous.crop.width / previous.width) * imageWidth, imageWidth);
				const height = Math.min(
					(previous.crop.height / previous.height) * imageHeight,
					imageHeight
				);
				crop = {
					x: Math.max(0, Math.min(imageWidth - width, mappedX)),
					y: Math.max(0, Math.min(imageHeight - height, mappedY)),
					width,
					height
				};
			}
			pendingCrop = null;
			syncCropDimensions();
		}
		syncOutputValueBounds();
		setMessage('');
	}

	function handleImageError() {
		setMessage('This image could not be opened. Try a different image file.', true);
	}

	function handleFileInput(event) {
		loadImage(event.currentTarget.files?.[0]);
		event.currentTarget.value = '';
	}

	function handleDrop(event) {
		event.preventDefault();
		isDraggingOver = false;
		loadImage(event.dataTransfer?.files?.[0]);
	}

	function handlePaste(event) {
		const file = [...(event.clipboardData?.items || [])]
			.find((item) => item.type.startsWith('image/'))
			?.getAsFile();
		if (file) {
			event.preventDefault();
			loadImage(file);
		}
	}

	function updateRatioCrop(ratio) {
		if (!ratio || !imageWidth || !imageHeight) return;
		let width = Math.min(crop.width || imageWidth, imageWidth, imageHeight * ratio);
		let height = width / ratio;
		if (height > imageHeight) {
			height = imageHeight;
			width = height * ratio;
		}
		const x = Math.min(crop.x, imageWidth - width);
		const y = Math.min(crop.y, imageHeight - height);
		crop = { x, y, width, height };
		syncCropDimensions();
		syncOutputValueBounds();
	}

	function handleAspectChange(event) {
		aspectChoice = event.currentTarget.value;
		if (aspectChoice === 'free') {
			cropMode = 'free';
			dimensionWidth = '';
			dimensionHeight = '';
			return;
		}
		cropMode = 'ratio';
		updateRatioCrop(currentRatio());
		syncOutputValueBounds();
	}

	function handleCustomRatioInput() {
		if (aspectChoice !== 'custom') return;
		cropMode = 'ratio';
		updateRatioCrop(currentRatio());
		syncOutputValueBounds();
	}

	function handleDimensionInput(changedField) {
		const changedValue = Number(changedField === 'width' ? dimensionWidth : dimensionHeight);
		if (!Number.isInteger(changedValue) || changedValue < 1) return;
		const width =
			changedField === 'width'
				? Math.min(changedValue, imageWidth)
				: Math.round(crop.width || imageWidth);
		const height =
			changedField === 'height'
				? Math.min(changedValue, imageHeight)
				: Math.round(crop.height || imageHeight);
		aspectChoice = 'free';
		cropMode = 'free';
		const x = Math.min(crop.x, imageWidth - width);
		const y = Math.min(crop.y, imageHeight - height);
		crop = { x, y, width, height };
		syncCropDimensions();
		syncOutputValueBounds();
		setMessage('');
	}

	function syncOutputDimensions(changedField, value) {
		if (changedField === 'width') outputWidth = value;
		else outputHeight = value;
		if (value === '') {
			if (outputResizeMode === changedField) outputResizeMode = '';
			return;
		}
		const number = Number(value);
		if (!Number.isInteger(number) || number <= 0) return;
		outputResizeMode = changedField;
		if (changedField === 'width') {
			outputWidth = String(Math.min(number, Math.round(crop.width)));
			outputHeight = '';
			outputScale = '';
		} else {
			outputHeight = String(Math.min(number, Math.round(crop.height)));
			outputWidth = '';
			outputScale = '';
		}
	}

	function syncOutputScale(value) {
		outputScale = value;
		if (value === '') {
			if (outputResizeMode === 'scale') outputResizeMode = '';
			return;
		}
		const scale = Number(value);
		if (!Number.isFinite(scale) || scale <= 0 || !crop.width || !crop.height) return;
		outputResizeMode = 'scale';
		outputScale = String(Math.min(scale, 100));
		outputWidth = '';
		outputHeight = '';
	}

	function syncOutputValueBounds() {
		if (outputResizeMode === 'scale' && Number(outputScale) > 100) outputScale = '100';
		if (outputResizeMode === 'width' && Number(outputWidth) > crop.width) {
			outputWidth = String(Math.round(crop.width));
		}
		if (outputResizeMode === 'height' && Number(outputHeight) > crop.height) {
			outputHeight = String(Math.round(crop.height));
		}
	}

	function syncCropDimensions() {
		dimensionWidth = String(Math.round(crop.width));
		dimensionHeight = String(Math.round(crop.height));
	}

	function updateCropPosition(coordinate, rawValue) {
		const value = Number(rawValue);
		if (!Number.isFinite(value) || !imageWidth || !imageHeight) return;

		let x = crop.x;
		let y = crop.y;
		if (coordinate === 'leftX') x = value;
		else if (coordinate === 'leftY') y = value;
		else if (coordinate === 'centerX') x = value - crop.width / 2;
		else if (coordinate === 'centerY') y = value - crop.height / 2;
		else return;

		crop = {
			...crop,
			x: Math.max(0, Math.min(imageWidth - crop.width, x)),
			y: Math.max(0, Math.min(imageHeight - crop.height, y))
		};
	}

	function imagePoint(event) {
		const bounds = imageFrame.getBoundingClientRect();
		return {
			x: ((event.clientX - bounds.left) / bounds.width) * imageWidth,
			y: ((event.clientY - bounds.top) / bounds.height) * imageHeight
		};
	}

	function startMove(event) {
		if (event.button !== 0) return;
		event.preventDefault();
		event.currentTarget.focus({ preventScroll: true });
		const point = imagePoint(event);
		pointerAction = { mode: 'move', start: point, crop: { ...crop } };
		setMessage('');
	}

	function startResize(event, corner) {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		pointerAction = { mode: 'resize', corner, start: imagePoint(event), crop: { ...crop } };
		setMessage('');
	}

	function handlePointerMove(event) {
		if (!pointerAction || !imageWidth || !imageHeight) return;
		const point = imagePoint(event);
		const dx = point.x - pointerAction.start.x;
		const dy = point.y - pointerAction.start.y;
		const initial = pointerAction.crop;
		if (pointerAction.mode === 'move') {
			crop = {
				...initial,
				x: Math.max(0, Math.min(imageWidth - initial.width, initial.x + dx)),
				y: Math.max(0, Math.min(imageHeight - initial.height, initial.y + dy))
			};
			return;
		}

		const corner = pointerAction.corner;
		const horizontalDirection = corner.includes('w') ? -1 : 1;
		const verticalDirection = corner.includes('n') ? -1 : 1;
		const anchorX = horizontalDirection < 0 ? initial.x + initial.width : initial.x;
		const anchorY = verticalDirection < 0 ? initial.y + initial.height : initial.y;
		const maxWidth = horizontalDirection < 0 ? anchorX : imageWidth - anchorX;
		const maxHeight = verticalDirection < 0 ? anchorY : imageHeight - anchorY;
		const desiredWidth = (point.x - anchorX) * horizontalDirection;
		const desiredHeight = (point.y - anchorY) * verticalDirection;
		const ratio = currentRatio();
		if (ratio) {
			const ratioWidth = Math.min(maxWidth, maxHeight * ratio);
			const minWidth = Math.min(1, ratioWidth);
			const width = Math.max(
				minWidth,
				Math.min(ratioWidth, (desiredWidth + desiredHeight * ratio) / 2)
			);
			const height = width / ratio;
			crop = {
				x: horizontalDirection < 0 ? anchorX - width : anchorX,
				y: verticalDirection < 0 ? anchorY - height : anchorY,
				width,
				height
			};
		} else {
			const width = Math.max(Math.min(1, maxWidth), Math.min(maxWidth, desiredWidth));
			const height = Math.max(Math.min(1, maxHeight), Math.min(maxHeight, desiredHeight));
			crop = {
				x: horizontalDirection < 0 ? anchorX - width : anchorX,
				y: verticalDirection < 0 ? anchorY - height : anchorY,
				width,
				height
			};
		}
		syncCropDimensions();
		syncOutputValueBounds();
	}

	function endPointerAction() {
		pointerAction = null;
	}

	function nudgeCrop(event) {
		if (!imageUrl) return;
		if (event.defaultPrevented) return;
		const target = event.target;
		if (
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				target.closest('input, textarea, select, [contenteditable="true"]'))
		) {
			return;
		}
		const amount = event.shiftKey ? 10 : 1;
		let x = crop.x;
		let y = crop.y;
		if (event.key === 'ArrowLeft') x -= amount;
		else if (event.key === 'ArrowRight') x += amount;
		else if (event.key === 'ArrowUp') y -= amount;
		else if (event.key === 'ArrowDown') y += amount;
		else return;
		event.preventDefault();
		crop = {
			...crop,
			x: Math.max(0, Math.min(imageWidth - crop.width, x)),
			y: Math.max(0, Math.min(imageHeight - crop.height, y))
		};
	}

	function resizeCropWithKeyboard(event) {
		const amount = event.shiftKey ? 10 : 1;
		const direction = ['ArrowRight', 'ArrowDown'].includes(event.key)
			? 1
			: ['ArrowLeft', 'ArrowUp'].includes(event.key)
				? -1
				: 0;
		if (!direction) return;
		event.preventDefault();
		event.stopPropagation();
		const ratio = currentRatio();
		if (ratio) {
			const maxWidth = Math.min(imageWidth - crop.x, (imageHeight - crop.y) * ratio);
			const width = Math.max(
				Math.min(1, maxWidth),
				Math.min(maxWidth, crop.width + direction * amount)
			);
			crop = { ...crop, width, height: width / ratio };
		} else {
			crop = {
				...crop,
				width:
					event.key === 'ArrowLeft' || event.key === 'ArrowRight'
						? Math.max(1, Math.min(imageWidth - crop.x, crop.width + direction * amount))
						: crop.width,
				height:
					event.key === 'ArrowUp' || event.key === 'ArrowDown'
						? Math.max(1, Math.min(imageHeight - crop.y, crop.height + direction * amount))
						: crop.height
			};
		}
		syncCropDimensions();
		syncOutputValueBounds();
	}

	function makeBlob(type) {
		return new Promise((resolve, reject) => {
			if (!imageElement || !crop.width || !crop.height) {
				reject(new Error('Load an image and select a crop area first.'));
				return;
			}
			const width = outputResizePreview.exportWidth;
			const height = outputResizePreview.exportHeight;
			if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
				reject(new Error('Output width and height must be positive whole numbers.'));
				return;
			}
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const context = canvas.getContext('2d');
			if (!context) {
				reject(new Error('Your browser could not create an image canvas.'));
				return;
			}
			if (type === 'image/jpeg') {
				context.fillStyle = '#ffffff';
				context.fillRect(0, 0, width, height);
			}
			context.drawImage(imageElement, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('The image could not be exported.'))),
				type
			);
		});
	}

	async function downloadImage() {
		try {
			const blob = await makeBlob(outputFormat);
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			const extension = outputFormat === 'image/jpeg' ? 'jpg' : outputFormat.split('/')[1];
			link.href = url;
			link.download = `${imageName}-crop.${extension}`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			setMessage('Cropped image downloaded.');
		} catch (error) {
			setMessage(error.message, true);
		}
	}

	async function copyImage() {
		try {
			if (!navigator.clipboard?.write || !window.ClipboardItem) {
				throw new Error('Image clipboard access is not supported in this browser or page context.');
			}
			const blob = await makeBlob('image/png');
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			setMessage('Cropped image copied to clipboard.');
		} catch (error) {
			setMessage(error.message || 'Could not copy the image to clipboard.', true);
		}
	}

	onDestroy(() => {
		if (imageUrl) URL.revokeObjectURL(imageUrl);
	});
</script>

<svelte:head>
	<title>Image Cropper | DevTools</title>
	<meta
		name="description"
		content="Crop, resize, download, or copy an image. Everything runs locally in your browser."
	/>
</svelte:head>

<svelte:window
	onpointermove={handlePointerMove}
	onpointerup={endPointerAction}
	onpaste={handlePaste}
	onkeydown={nudgeCrop}
/>

<main class="crop-page">
	<header class="post-header">
		<h1>Image Cropper</h1>
		<span class="post-date">Crop and resize images locally in your browser.</span>
	</header>

	{#if !imageUrl}
		<div
			class:drop-active={isDraggingOver}
			class="drop-zone"
			ondragover={(event) => {
				event.preventDefault();
				isDraggingOver = true;
			}}
			ondragleave={() => (isDraggingOver = false)}
			ondrop={handleDrop}
		>
			<div class="drop-icon" aria-hidden="true">↥</div>
			<h2>Drop an image here</h2>
			<p>or browse your files, or paste an image from your clipboard</p>
			<button class="btn-secondary" onclick={() => fileInput?.click()}>Choose image</button>
			<input
				bind:this={fileInput}
				class="file-input"
				type="file"
				accept="image/*"
				onchange={handleFileInput}
				aria-label="Choose an image"
			/>
			<span class="privacy-note">Your image stays on your device.</span>
		</div>
	{:else}
		<div class="toolbar">
			<div>
				<strong>{imageName}</strong>
				<span>{imageWidth} × {imageHeight}px</span>
			</div>
			<button class="text-btn" onclick={() => fileInput?.click()}>Choose another</button>
			<input
				bind:this={fileInput}
				class="file-input"
				type="file"
				accept="image/*"
				onchange={handleFileInput}
				aria-label="Choose another image"
			/>
		</div>

		<section class="crop-workspace" aria-label="Image crop workspace">
			<div class="image-scroll">
				<div class="image-frame" bind:this={imageFrame}>
					<img
						bind:this={imageElement}
						src={imageUrl}
						alt="Image being cropped"
						onload={handleImageLoad}
						onerror={handleImageError}
					/>
					<div
						class="crop-box"
						style={cropStyle}
						role="application"
						tabindex="0"
						aria-label="Move crop area with arrow keys"
						onpointerdown={startMove}
					>
						{#if gridVisible}
							<div class="crop-grid" aria-hidden="true">
								<span class="grid-line vertical first"></span>
								<span class="grid-line vertical second"></span>
								<span class="grid-line horizontal first"></span>
								<span class="grid-line horizontal second"></span>
							</div>
						{/if}
						<span class="crop-size">{Math.round(crop.width)} × {Math.round(crop.height)}</span>
						{#each ['nw', 'ne', 'sw', 'se'] as corner}
							<div
								class="resize-handle {corner}"
								role="slider"
								tabindex="0"
								onpointerdown={(event) => startResize(event, corner)}
								onkeydown={resizeCropWithKeyboard}
								aria-label="Resize crop area from {corner} corner"
								aria-valuemin="1"
								aria-valuemax={imageWidth - crop.x}
								aria-valuenow={Math.round(crop.width)}
							></div>
						{/each}
					</div>
				</div>
			</div>
		</section>
		<div class="crop-workspace-toolbar">
			<button
				class="btn-secondary grid-toggle"
				type="button"
				aria-pressed={gridVisible}
				onclick={() => (gridVisible = !gridVisible)}
			>
				{gridVisible ? 'Hide grid lines' : 'Show grid lines'}
			</button>
		</div>
		<section class="settings" aria-label="Crop settings">
			<div class="setting-block">
				<h2>Crop area</h2>
				<div class="control-grid">
					<div class="setting-item">
						<label for="aspect-ratio">Aspect ratio</label>
						<select id="aspect-ratio" value={aspectChoice} onchange={handleAspectChange}>
							{#each ASPECT_RATIOS as ratio}
								<option value={ratio.value}>{ratio.label}</option>
							{/each}
						</select>
					</div>
					<div class="setting-item">
						<label for="current-aspect-ratio">Current crop ratio</label>
						<input id="current-aspect-ratio" type="text" value={currentAspectRatio} readonly />
					</div>
					<div class="setting-item coordinate-item">
						<label>Crop position (px)</label>
						<div class="coordinate-values">
							<span>
								<strong class="coordinate-label">Top-left</strong>
								<span class="coordinate-pair">
									<input
										type="number"
										min="0"
										max={Math.max(0, imageWidth - crop.width)}
										step="1"
										value={cropCoordinates.leftX}
										onchange={(event) => updateCropPosition('leftX', event.currentTarget.value)}
										aria-label="Crop left position in pixels"
									/>
									<input
										type="number"
										min="0"
										max={Math.max(0, imageHeight - crop.height)}
										step="1"
										value={cropCoordinates.leftY}
										onchange={(event) => updateCropPosition('leftY', event.currentTarget.value)}
										aria-label="Crop top position in pixels"
									/>
								</span>
							</span>
							<span>
								<strong class="coordinate-label">Center</strong>
								<span class="coordinate-pair">
									<input
										type="number"
										min={crop.width / 2}
										max={imageWidth - crop.width / 2}
										step="0.5"
										value={cropCoordinates.centerX}
										onchange={(event) => updateCropPosition('centerX', event.currentTarget.value)}
										aria-label="Crop horizontal center position in pixels"
									/>
									<input
										type="number"
										min={crop.height / 2}
										max={imageHeight - crop.height / 2}
										step="0.5"
										value={cropCoordinates.centerY}
										onchange={(event) => updateCropPosition('centerY', event.currentTarget.value)}
										aria-label="Crop vertical center position in pixels"
									/>
								</span>
							</span>
						</div>
					</div>
					{#if aspectChoice === 'custom'}
						<div class="setting-item">
							<label for="custom-ratio-width">Custom ratio</label>
							<div class="paired-input">
								<input
									id="custom-ratio-width"
									type="number"
									min="1"
									step="1"
									bind:value={customRatioWidth}
									oninput={handleCustomRatioInput}
									aria-label="Custom ratio width"
								/>
								<span>:</span>
								<input
									type="number"
									min="1"
									step="1"
									bind:value={customRatioHeight}
									oninput={handleCustomRatioInput}
									aria-label="Custom ratio height"
								/>
							</div>
						</div>
					{/if}
					<div class="setting-item dimensions-item">
						<label for="crop-width">Exact crop size (source px)</label>
						<div class="paired-input">
							<input
								id="crop-width"
								type="number"
								min="1"
								max={imageWidth}
								placeholder="Width"
								bind:value={dimensionWidth}
								oninput={() => handleDimensionInput('width')}
								aria-label="Crop width in source pixels"
							/>
							<span>×</span>
							<input
								id="crop-height"
								type="number"
								min="1"
								max={imageHeight}
								placeholder="Height"
								bind:value={dimensionHeight}
								oninput={() => handleDimensionInput('height')}
								aria-label="Crop height in source pixels"
							/>
						</div>
					</div>
				</div>
			</div>

			<div class="setting-block">
				<h2>Output</h2>
				<div class="control-grid">
					<div class="setting-item output-size">
						<label for="output-scale">Resize output (optional)</label>
						<div class="scale-input">
							<input
								id="output-scale"
								type="number"
								min="0.01"
								max="100"
								step="any"
								placeholder={outputResizePreview.scale}
								value={outputScale}
								oninput={(event) => syncOutputScale(event.currentTarget.value)}
								aria-label="Output scale percentage"
							/>
							<span>%</span>
						</div>
						<small>Set one value; the other resize values are calculated automatically.</small>
						<label for="output-width" class="pixel-size-label">Exact output size (px)</label>
						<div class="paired-input">
							<input
								id="output-width"
								type="number"
								min="1"
								max={Math.round(crop.width)}
								placeholder={outputResizePreview.width}
								value={outputWidth}
								oninput={(event) => syncOutputDimensions('width', event.currentTarget.value)}
								aria-label="Output width in pixels"
							/>
							<span>×</span>
							<input
								id="output-height"
								type="number"
								min="1"
								max={Math.round(crop.height)}
								placeholder={outputResizePreview.height}
								value={outputHeight}
								oninput={(event) => syncOutputDimensions('height', event.currentTarget.value)}
								aria-label="Output height in pixels"
							/>
						</div>
					</div>
					<div class="setting-item">
						<label for="output-format">File format</label>
						<select id="output-format" bind:value={outputFormat}>
							<option value="image/png">PNG</option>
							<option value="image/jpeg">JPEG</option>
							<option value="image/webp">WebP</option>
						</select>
					</div>
				</div>
			</div>
			<div class="export-actions">
				<button class="btn-primary" onclick={downloadImage}>Download crop</button>
				<button class="btn-secondary" onclick={copyImage}>Copy image</button>
			</div>
		</section>
	{/if}

	{#if errorMessage}
		<p class="status-message error" role="alert">{errorMessage}</p>
	{:else if successMessage}
		<p class="status-message" role="status">{successMessage}</p>
	{/if}
</main>

<style>
	.crop-page {
		width: 100%;
	}

	.crop-page .post-header {
		margin-bottom: 1.5rem;
	}

	.drop-zone {
		min-height: 310px;
		border: 1px dashed var(--border);
		border-radius: 8px;
		padding: 2.5rem 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		transition:
			border-color 0.15s,
			background 0.15s;
	}

	.drop-zone.drop-active {
		border-color: var(--accent-gold);
		background: rgba(251, 191, 36, 0.07);
	}

	.drop-icon {
		font-size: 2.5rem;
		color: var(--accent-gold);
		line-height: 1;
		margin-bottom: 0.75rem;
	}

	.drop-zone h2 {
		margin: 0 0 0.4rem;
	}

	.drop-zone p,
	.privacy-note,
	.canvas-hint,
	.setting-item small {
		color: var(--gray);
		font-size: 0.8rem;
	}

	.drop-zone p {
		margin-bottom: 1.25rem;
	}

	.privacy-note {
		margin-top: 1rem;
	}

	.file-input {
		display: none;
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
		font-size: 0.8rem;
	}

	.toolbar > div {
		display: flex;
		gap: 0.7rem;
		align-items: baseline;
		min-width: 0;
		margin-right: auto;
	}

	.toolbar strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.toolbar span {
		color: var(--gray);
		white-space: nowrap;
	}

	.crop-workspace {
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: rgba(128, 128, 128, 0.04);
	}

	.crop-workspace-toolbar {
		display: flex;
		margin: 0.5rem 0;
	}

	.grid-toggle {
		padding: 0.35rem 0.65rem;
		font-size: 0.75rem;
	}

	.image-scroll {
		overflow: visible;
		display: flex;
		justify-content: center;
	}

	.image-frame {
		position: relative;
		display: inline-block;
		max-width: 100%;
		line-height: 0;
		touch-action: none;
		user-select: none;
	}

	.image-frame img {
		display: block;
		max-width: 100%;
		max-height: 68vh;
		object-fit: contain;
	}

	.crop-box {
		position: absolute;
		z-index: 1;
		border: 2px solid #fff;
		cursor: move;
		touch-action: none;
	}

	.crop-box:focus {
		outline: none;
	}

	.crop-grid {
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
	}

	.grid-line {
		position: absolute;
		display: block;
		background: rgba(255, 255, 255, 0.8);
		pointer-events: none;
	}

	.grid-line.vertical {
		top: 0;
		bottom: 0;
		width: 1px;
	}

	.grid-line.vertical.first {
		left: 33.333%;
	}

	.grid-line.vertical.second {
		left: 66.667%;
	}

	.grid-line.horizontal {
		left: 0;
		right: 0;
		height: 1px;
	}

	.grid-line.horizontal.first {
		top: 33.333%;
	}

	.grid-line.horizontal.second {
		top: 66.667%;
	}

	.crop-size {
		position: absolute;
		top: calc(100% + 6px);
		left: 2px;
		overflow: hidden;
		padding: 0.15rem 0.35rem;
		background: rgba(0, 0, 0, 0.75);
		color: #fff;
		font-size: 0.65rem;
		line-height: 1.3;
		white-space: nowrap;
		text-overflow: ellipsis;
		pointer-events: none;
	}

	.resize-handle {
		position: absolute;
		z-index: 2;
		width: 10px;
		height: 10px;
		background: #fff;
		border: 1px solid var(--accent-blue);
		border-radius: 2px;
		cursor: nwse-resize;
		touch-action: none;
	}

	.resize-handle.nw {
		top: 0;
		left: 0;
		transform: translate(-50%, -50%);
		cursor: nwse-resize;
	}

	.resize-handle.ne {
		top: 0;
		right: 0;
		transform: translate(50%, -50%);
		cursor: nesw-resize;
	}

	.resize-handle.sw {
		bottom: 0;
		left: 0;
		transform: translate(-50%, 50%);
		cursor: nesw-resize;
	}

	.resize-handle.se {
		right: 0;
		bottom: 0;
		transform: translate(50%, 50%);
		cursor: nwse-resize;
	}

	.canvas-hint {
		text-align: center;
		margin: 0.75rem 0 0;
	}

	.settings {
		margin: 1.5rem 0;
	}

	.setting-block + .setting-block {
		margin-top: 1.25rem;
	}

	.setting-block h2 {
		font-size: 1rem;
		margin: 0 0 0.65rem;
	}

	.control-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: rgba(128, 128, 128, 0.03);
		align-items: flex-end;
	}

	.setting-item {
		min-width: 120px;
	}

	.setting-item label {
		font-size: 0.7rem;
		margin-bottom: 0.35rem;
	}

	.setting-item select,
	.setting-item input {
		padding: 0.55rem;
		font-size: 0.8rem;
		background-color: var(--bg);
	}

	.paired-input {
		display: flex;
		gap: 0.45rem;
		align-items: center;
	}

	.paired-input input {
		min-width: 0;
	}

	.paired-input span {
		color: var(--gray);
	}

	.scale-input {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.scale-input input {
		min-width: 0;
	}

	.scale-input span {
		color: var(--gray);
	}

	.pixel-size-label {
		margin-top: 0.6rem;
	}

	.dimensions-item,
	.output-size {
		flex-grow: 1.5;
	}

	.setting-item small {
		display: block;
		margin-top: 0.35rem;
		line-height: 1.4;
	}

	.coordinate-values {
		display: flex;
		gap: 0.75rem;
		min-height: 2.65rem;
		align-items: flex-start;
		flex-wrap: wrap;
		font-size: 0.75rem;
		color: var(--gray);
	}

	.coordinate-values strong {
		color: var(--fg);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.coordinate-values > span {
		display: grid;
		grid-template-columns: 10ch 1fr;
		align-items: center;
		gap: 0.35rem;
	}

	.coordinate-values .coordinate-label {
		white-space: nowrap;
	}

	.coordinate-pair {
		display: grid;
		grid-template-columns: repeat(2, 10ch);
		gap: 0.5ch;
	}

	.coordinate-pair input {
		width: 10ch;
		min-width: 0;
		padding: 0.35rem 0.2rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.center-coordinate-pair input {
		text-align: right;
	}

	.export-actions {
		display: flex;
		gap: 0.65rem;
		margin-top: 1.25rem;
		flex-wrap: wrap;
	}

	.status-message {
		margin: 0.75rem 0 0;
		font-size: 0.8rem;
		color: var(--accent-green);
	}

	.status-message.error {
		color: var(--accent-red);
	}

	@media (max-width: 520px) {
		.toolbar {
			align-items: flex-start;
		}

		.toolbar > div {
			flex-direction: column;
			gap: 0.1rem;
		}

		.control-grid {
			padding: 0.75rem;
			gap: 0.8rem;
		}

		.setting-item {
			flex-basis: 100%;
		}
	}
</style>
