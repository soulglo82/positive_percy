import { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge'

export default function VisualEditAgent() {
	const [isVisualEditMode, setIsVisualEditMode] = useState(false);
	const isVisualEditModeRef = useRef(false);
	const [isPopoverDragging, setIsPopoverDragging] = useState(false);
	const isPopoverDraggingRef = useRef(false);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const isDropdownOpenRef = useRef(false);
	const hoverOverlaysRef = useRef([]);
	const selectedOverlaysRef = useRef([]);
	const currentHighlightedElementsRef = useRef([]);
	const selectedElementIdRef = useRef(null);

	const createOverlay = (isSelected = false) => {
		const overlay = document.createElement('div');
		overlay.style.position = 'absolute';
		overlay.style.pointerEvents = 'none';
		overlay.style.transition = 'all 0.1s ease-in-out';
		overlay.style.zIndex = '9999';
		if (isSelected) {
			overlay.style.border = '2px solid #2563EB';
		} else {
			overlay.style.border = '2px solid #95a5fc';
			overlay.style.backgroundColor = 'rgba(99, 102, 241, 0.05)';
		}
		return overlay;
	};

	const positionOverlay = (overlay, element, isSelected = false) => {
		if (!element || !isVisualEditModeRef.current) return;
		void element.offsetWidth;
		const rect = element.getBoundingClientRect();
		overlay.style.top = `${rect.top + window.scrollY}px`;
		overlay.style.left = `${rect.left + window.scrollX}px`;
		overlay.style.width = `${rect.width}px`;
		overlay.style.height = `${rect.height}px`;
		let label = overlay.querySelector('div');
		if (!label) {
			label = document.createElement('div');
			label.textContent = element.tagName.toLowerCase();
			label.style.position = 'absolute';
			label.style.top = '-27px';
			label.style.left = '-2px';
			label.style.padding = '2px 8px';
			label.style.fontSize = '11px';
			label.style.fontWeight = isSelected ? '500' : '400';
			label.style.color = isSelected ? '#ffffff' : '#526cff';
			label.style.backgroundColor = isSelected ? '#526cff' : '#DBEAFE';
			label.style.borderRadius = '3px';
			label.style.boxShadow = isSelected ? 'none' : 'none';
			label.style.minWidth = '24px';
			label.style.textAlign = 'center';
			overlay.appendChild(label);
		}
	};

	const findElementsById = (id) => {
		if (!id) return [];
		const sourceElements = [...document.querySelectorAll(`[data-source-location="${id}"]`)];
		if (sourceElements.length > 0) return sourceElements;
		return [...document.querySelectorAll(`[data-visual-selector-id="${id}"]`)];
	};

	const clearHoverOverlays = () => {
		hoverOverlaysRef.current.forEach(overlay => {
			if (overlay && overlay.parentNode) overlay.remove();
		});
		hoverOverlaysRef.current = [];
		currentHighlightedElementsRef.current = [];
	};

	const handleMouseOver = (e) => {
		if (!isVisualEditModeRef.current || isPopoverDraggingRef.current) return;
		if (isDropdownOpenRef.current) { clearHoverOverlays(); return; }
		if (e.target.tagName.toLowerCase() === 'path') { clearHoverOverlays(); return; }
		const element = e.target.closest('[data-source-location], [data-visual-selector-id]');
		if (!element) { clearHoverOverlays(); return; }
		const selectorId = element.dataset.sourceLocation || element.dataset.visualSelectorId;
		if (selectedElementIdRef.current === selectorId) { clearHoverOverlays(); return; }
		const elements = findElementsById(selectorId);
		clearHoverOverlays();
		elements.forEach(el => {
			const overlay = createOverlay(false);
			document.body.appendChild(overlay);
			hoverOverlaysRef.current.push(overlay);
			positionOverlay(overlay, el);
		});
		currentHighlightedElementsRef.current = elements;
	};

	const handleMouseOut = () => {
		if (isPopoverDraggingRef.current) return;
		clearHoverOverlays();
	};

	const handleElementClick = (e) => {
		if (!isVisualEditModeRef.current) return;
		if (isDropdownOpenRef.current) {
			e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
			window.parent.postMessage({ type: 'close-dropdowns' }, '*');
			return;
		}
		if (e.target.tagName.toLowerCase() === 'path') return;
		e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
		const element = e.target.closest('[data-source-location], [data-visual-selector-id]');
		if (!element) return;
		const visualSelectorId = element.dataset.sourceLocation || element.dataset.visualSelectorId;
		selectedOverlaysRef.current.forEach(overlay => { if (overlay && overlay.parentNode) overlay.remove(); });
		selectedOverlaysRef.current = [];
		const elements = findElementsById(visualSelectorId);
		elements.forEach(el => {
			const overlay = createOverlay(true);
			document.body.appendChild(overlay);
			selectedOverlaysRef.current.push(overlay);
			positionOverlay(overlay, el, true);
		});
		selectedElementIdRef.current = visualSelectorId;
		clearHoverOverlays();
		const rect = element.getBoundingClientRect();
		const elementPosition = {
			top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom,
			width: rect.width, height: rect.height,
			centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2
		};
		const elementData = {
			type: 'element-selected', tagName: element.tagName,
			classes: element.className?.baseVal || element.className || '',
			visualSelectorId, content: element.innerText,
			dataSourceLocation: element.dataset.sourceLocation,
			isDynamicContent: element.dataset.dynamicContent === 'true',
			linenumber: element.dataset.linenumber, filename: element.dataset.filename,
			position: elementPosition
		};
		window.parent.postMessage(elementData, '*');
	};

	const unselectElement = () => {
		selectedOverlaysRef.current.forEach(overlay => { if (overlay && overlay.parentNode) overlay.remove(); });
		selectedOverlaysRef.current = [];
		selectedElementIdRef.current = null;
	};

	const updateElementClasses = (visualSelectorId, classes, replace = false) => {
		const elements = findElementsById(visualSelectorId);
		if (elements.length === 0) return;
		elements.forEach(element => {
			if (replace) { element.className = classes; }
			else {
				const currentClasses = element.className?.baseVal || element.className || '';
				element.className = twMerge(currentClasses, classes);
			}
		});
		setTimeout(() => {
			if (selectedElementIdRef.current === visualSelectorId) {
				selectedOverlaysRef.current.forEach((overlay, index) => {
					if (index < elements.length) positionOverlay(overlay, elements[index]);
				});
			}
			if (currentHighlightedElementsRef.current.length > 0) {
				const hoveredId = currentHighlightedElementsRef.current[0]?.dataset?.visualSelectorId;
				if (hoveredId === visualSelectorId) {
					hoverOverlaysRef.current.forEach((overlay, index) => {
						if (index < currentHighlightedElementsRef.current.length) positionOverlay(overlay, currentHighlightedElementsRef.current[index]);
					});
				}
			}
		}, 50);
	};

	const updateElementContent = (visualSelectorId, content) => {
		const elements = findElementsById(visualSelectorId);
		if (elements.length === 0) return;
		elements.forEach((element) => { element.innerText = content; });
		setTimeout(() => {
			if (selectedElementIdRef.current === visualSelectorId) {
				selectedOverlaysRef.current.forEach((overlay, index) => {
					if (index < elements.length) positionOverlay(overlay, elements[index]);
				});
			}
		}, 50);
	};

	const toggleVisualEditMode = (isEnabled) => {
		setIsVisualEditMode(isEnabled);
		isVisualEditModeRef.current = isEnabled;
		if (!isEnabled) {
			clearHoverOverlays();
			selectedOverlaysRef.current.forEach(overlay => { if (overlay && overlay.parentNode) overlay.remove(); });
			selectedOverlaysRef.current = [];
			currentHighlightedElementsRef.current = [];
			selectedElementIdRef.current = null;
			document.body.style.cursor = 'default';
			document.removeEventListener('mouseover', handleMouseOver);
			document.removeEventListener('mouseout', handleMouseOut);
			document.removeEventListener('click', handleElementClick, true);
		} else {
			document.body.style.cursor = 'crosshair';
			document.addEventListener('mouseover', handleMouseOver);
			document.addEventListener('mouseout', handleMouseOut);
			document.addEventListener('click', handleElementClick, true);
		}
	};

	useEffect(() => {
		const elementsWithLineNumber = document.querySelectorAll('[data-linenumber]:not([data-visual-selector-id])');
		elementsWithLineNumber.forEach((el, index) => {
			const id = `visual-id-${el.dataset.filename}-${el.dataset.linenumber}-${index}`;
			el.dataset.visualSelectorId = id;
		});

		const handleScroll = () => {
			if (selectedElementIdRef.current) {
				const elements = findElementsById(selectedElementIdRef.current);
				if (elements.length > 0) {
					const element = elements[0];
					const rect = element.getBoundingClientRect();
					const viewportHeight = window.innerHeight;
					const viewportWidth = window.innerWidth;
					const isInViewport = (rect.top < viewportHeight && rect.bottom > 0 && rect.left < viewportWidth && rect.right > 0);
					const elementPosition = {
						top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom,
						width: rect.width, height: rect.height,
						centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2
					};
					window.parent.postMessage({ type: 'element-position-update', position: elementPosition, isInViewport, visualSelectorId: selectedElementIdRef.current }, '*');
				}
			}
		};

		const handleMessage = (event) => {
			const message = event.data;
			switch (message.type) {
				case 'toggle-visual-edit-mode':
					toggleVisualEditMode(message.data.enabled);
					break;
				case 'update-classes':
					if (message.data && message.data.classes !== undefined) {
						updateElementClasses(message.data.visualSelectorId, message.data.classes, message.data.replace || false);
					}
					break;
				case 'unselect-element':
					unselectElement();
					break;
				case 'refresh-page':
					window.location.reload();
					break;
				case 'update-content':
					if (message.data && message.data.content !== undefined) {
						updateElementContent(message.data.visualSelectorId, message.data.content);
					}
					break;
				case 'request-element-position':
					if (selectedElementIdRef.current) {
						const elements = findElementsById(selectedElementIdRef.current);
						if (elements.length > 0) {
							const element = elements[0];
							const rect = element.getBoundingClientRect();
							const viewportHeight = window.innerHeight;
							const viewportWidth = window.innerWidth;
							const isInViewport = (rect.top < viewportHeight && rect.bottom > 0 && rect.left < viewportWidth && rect.right > 0);
							const elementPosition = {
								top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom,
								width: rect.width, height: rect.height,
								centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2
							};
							window.parent.postMessage({ type: 'element-position-update', position: elementPosition, isInViewport, visualSelectorId: selectedElementIdRef.current }, '*');
						}
					}
					break;
				case 'popover-drag-state':
					if (message.data && message.data.isDragging !== undefined) {
						setIsPopoverDragging(message.data.isDragging);
						isPopoverDraggingRef.current = message.data.isDragging;
						if (message.data.isDragging) clearHoverOverlays();
					}
					break;
				case 'dropdown-state':
					if (message.data && message.data.isOpen !== undefined) {
						setIsDropdownOpen(message.data.isOpen);
						isDropdownOpenRef.current = message.data.isOpen;
						if (message.data.isOpen) clearHoverOverlays();
					}
					break;
				default:
					break;
			}
		};

		window.addEventListener('message', handleMessage);
		window.addEventListener('scroll', handleScroll, true);
		document.addEventListener('scroll', handleScroll, true);
		window.parent.postMessage({ type: 'visual-edit-agent-ready' }, '*');

		return () => {
			window.removeEventListener('message', handleMessage);
			window.removeEventListener('scroll', handleScroll, true);
			document.removeEventListener('scroll', handleScroll, true);
			document.removeEventListener('mouseover', handleMouseOver);
			document.removeEventListener('mouseout', handleMouseOut);
			document.removeEventListener('click', handleElementClick, true);
			clearHoverOverlays();
			selectedOverlaysRef.current.forEach(overlay => { if (overlay && overlay.parentNode) overlay.remove(); });
		};
	}, []);

	useEffect(() => { isVisualEditModeRef.current = isVisualEditMode; }, [isVisualEditMode]);
	useEffect(() => { isPopoverDraggingRef.current = isPopoverDragging; }, [isPopoverDragging]);
	useEffect(() => { isDropdownOpenRef.current = isDropdownOpen; }, [isDropdownOpen]);

	useEffect(() => {
		const handleResize = () => {
			if (selectedElementIdRef.current) {
				const elements = findElementsById(selectedElementIdRef.current);
				selectedOverlaysRef.current.forEach((overlay, index) => {
					if (index < elements.length) positionOverlay(overlay, elements[index]);
				});
			}
			if (currentHighlightedElementsRef.current.length > 0) {
				hoverOverlaysRef.current.forEach((overlay, index) => {
					if (index < currentHighlightedElementsRef.current.length) positionOverlay(overlay, currentHighlightedElementsRef.current[index]);
				});
			}
		};

		const mutationObserver = new MutationObserver((mutations) => {
			const needsUpdate = mutations.some(mutation => {
				const hasVisualId = (node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						if (node.dataset && node.dataset.visualSelectorId) return true;
						for (let i = 0; i < node.children.length; i++) {
							if (hasVisualId(node.children[i])) return true;
						}
					}
					return false;
				};
				const isLayoutChange = mutation.type === 'attributes' &&
					(mutation.attributeName === 'style' || mutation.attributeName === 'class' ||
					 mutation.attributeName === 'width' || mutation.attributeName === 'height');
				return isLayoutChange && hasVisualId(mutation.target);
			});
			if (needsUpdate) setTimeout(handleResize, 50);
		});

		mutationObserver.observe(document.body, {
			attributes: true, childList: true, subtree: true,
			attributeFilter: ['style', 'class', 'width', 'height']
		});

		window.addEventListener('resize', handleResize);
		window.addEventListener('scroll', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('scroll', handleResize);
			mutationObserver.disconnect();
		};
	}, []);

	return null;
}
