/**
 * Mobile UX (browser half).
 *
 * Layout scope: any viewport up to 1023px — the same width at which the shipped
 * AppFrame auto-collapses its sidebar. 1) The sidebar column stops occupying a
 * grid track and becomes an off-canvas card drawer, revealed by a right swipe
 * from the left edge (or, with a mouse, a drag from the same edge). The center
 * column is nudged right and slightly scaled while the drawer is open, so the
 * drawer reads as a card lifted over the conversation instead of a panel that
 * squeezes it. Tapping a conversation (or the conversation area) closes it.
 *
 * Input scope: touch devices only. 2) Enter in the composer inserts a line break
 * instead of submitting, because a phone keyboard has no Shift key; the
 * composer's own send button submits.
 *
 * Column identity comes from the built CSS-module class names of ui-layout's
 * three columns (…_sidebarCol / …_centerCol), never from DOM order: the right
 * column's content is conditional, so sibling arithmetic is not a stable
 * identity. A post-mark self-check then measures the conversation column and
 * tears everything down again if the frame is not where it should be — a wrong
 * guess must never hide the conversation.
 *
 * TEMPORARY: a bottom-left badge reports which stage ran (boot → apply → ready /
 * no-frame / self-disable). It exists only until the integration is verified on
 * a real device and must be removed afterwards.
 */

window.__ModuleLoader__.load({
	id: '@local/dsh-mobile-ux',
	factory() {
		/** Temporary stage badge; remove with the diagnostic block in apply(). */
		const badge = (text, color) => {
			let el = document.getElementById('dsh-mobile-ux-badge');
			if (el === null) {
				el = document.createElement('div');
				el.id = 'dsh-mobile-ux-badge';
				el.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483647;padding:4px 8px;'
					+ 'border-radius:8px;font:11px/1.4 ui-monospace,Menlo,monospace;color:#fff;pointer-events:none;'
					+ 'opacity:.92;max-width:70vw;word-break:break-all';
				(document.body || document.documentElement).appendChild(el);
			}
			el.textContent = text;
			el.style.background = color;
			return el;
		};
		badge('UX v9: boot', '#555555');

		/**
		 * TEMPORARY: report this stage to the server through a throwaway request, so the
		 * nginx access log shows exactly how far the plugin got without a console.
		 * Remove together with the badge once the integration is verified.
		 */
		const probe = (stage) => {
			try {
				const frames = document.querySelectorAll('[data-shell-overlay]');
				const frame = frames.length > 0 ? frames[0].parentElement : null;
				const cols = frame === null ? 'noframe'
					: Array.prototype.map.call(frame.children, (el) => (el.getAttribute('class') || el.tagName)).join('|');
				const center = frame === null ? null : frame.querySelector('[data-dsh-mobile-center]');
				const drawer = frame === null ? null : frame.querySelector('[data-dsh-mobile-drawer]');
				const drawerRect = drawer === null ? null : drawer.getBoundingClientRect();
				const rect = center === null ? null : center.getBoundingClientRect();
				const computed = center === null ? null : window.getComputedStyle(center);
				let grid = '';
				try {
					grid = frame === null ? '' : window.getComputedStyle(frame).gridTemplateColumns;
				} catch (_gridError) {
					grid = '';
				}
				const url = '/__mux_probe?stage=' + stage
					+ '&w=' + window.innerWidth
					+ '&h=' + window.innerHeight
					+ '&narrow=' + (window.matchMedia('(max-width: 1023px)').matches ? 1 : 0)
					+ '&coarse=' + (window.matchMedia('(pointer: coarse)').matches ? 1 : 0)
					+ '&mt=' + (navigator.maxTouchPoints || 0)
					+ '&dw=' + (drawerRect === null ? -1 : Math.round(drawerRect.width))
					+ '&dh=' + (drawerRect === null ? -1 : Math.round(drawerRect.height))
					+ '&dvis=' + (drawer === null ? '?' : window.getComputedStyle(drawer).visibility)
					+ '&cw=' + (rect === null ? -1 : Math.round(rect.width))
					+ '&ch=' + (rect === null ? -1 : Math.round(rect.height))
					+ '&vis=' + (computed === null ? '?' : computed.visibility)
					+ '&disp=' + (computed === null ? '?' : computed.display)
					+ '&gtc=' + encodeURIComponent(grid)
					+ '&cols=' + encodeURIComponent(cols);
				window.fetch(url, { cache: 'no-store' }).catch(() => {});
			} catch (_error) { /* diagnostics only */ }
		};
		probe('boot');

		/** Width below which the frame collapses its sidebar (ui-layout contract). */
		const MOBILE_MEDIA = '(max-width: 1023px)';
		/** Class-name suffixes of the frame's sidebar and center columns. */
		const DRAWER_CLASS = 'sidebarCol';
		const CENTER_CLASS = 'centerCol';
		const RIGHTBAR_CLASS = 'rightbarCol';
		/** Left-edge band (px) where a gesture may start while the drawer is closed. */
		const EDGE_START = 44;
		/** Travel (px) that commits a gesture. */
		const SWIPE_MIN = 48;
		/** Travel (px) before a gesture is classified as horizontal or vertical. */
		const DIRECTION_SLOP = 10;
		/** Milliseconds after a committed gesture during which clicks are ignored. */
		const CLICK_SUPPRESS = 400;

		const CSS = [
			'@media ' + MOBILE_MEDIA + ' {',
			/* Strategy, learned the hard way on a real phone:
			   - the conversation column is never touched (no width, no transform);
			   - the sidebar column stays IN the grid flow (a pinned column leaves the
			     flow and auto-placement pushes the conversation into the 0px track), it
			     is simply 0px wide so it occupies nothing;
			   - the card is that column's own overflow, lifted above the conversation by
			     stacking order, and slid with a transform on the column itself (a real
			     element), because the slot may wrap the occupant in a display:contents
			     layer that ignores position entirely;
			   - show/hide rides on visibility, which inherits through such a wrapper. */
			'  [data-dsh-mobile-frame] {',
			'    grid-template-columns: 0 minmax(0, 1fr) 0 !important;',
			'  }',
			'  [data-dsh-mobile-frame] > [data-dsh-mobile-drawer] {',
			'    position: relative !important;',
			'    z-index: 30 !important;',
			'    grid-column: 1;',
			'    grid-row: 1;',
			'    overflow: visible !important;',
			'    border-right: none !important;',
			'    background: transparent !important;',
			'    visibility: hidden;',
			'    transform: translateX(-110vw);',
			'    transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1), visibility 280ms;',
			'  }',
			'  [data-dsh-mobile-frame]:not([data-sidebar-collapsed]) > [data-dsh-mobile-drawer] {',
			'    transform: translateX(0);',
			'    visibility: visible;',
			'  }',
			/* Card face, applied to the occupant. If a display:contents wrapper swallows
			   these, the occupant still brings its own sidebar background and width. */
			'  [data-dsh-mobile-frame] > [data-dsh-mobile-drawer] > * {',
			'    width: min(320px, 86vw) !important;',
			'    height: 100% !important;',
			'    box-sizing: border-box;',
			'    background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-base));',
			'    border-radius: 0 18px 18px 0;',
			'    box-shadow: 0 0 0 0.5px var(--dsw-alias-border-l3), 0 18px 48px rgba(0, 0, 0, 0.24);',
			'  }',
			/* Explicit tracks keep the conversation on the flexible column no matter
			   what later changes here. */
			'  [data-dsh-mobile-frame] > [data-dsh-mobile-center] {',
			'    grid-column: 2;',
			'    grid-row: 1;',
			'  }',
			'  [data-dsh-mobile-frame] > [data-dsh-mobile-rightbar] {',
			'    grid-column: 3;',
			'    grid-row: 1;',
			'  }',
			/* Scrim: sits under the card (z-index 5) and over the conversation. */
			'  [data-dsh-mobile-frame]:not([data-sidebar-collapsed])::after {',
			'    content: "";',
			'    position: fixed;',
			'    inset: 0;',
			'    z-index: 29;',
			'    background: rgba(0, 0, 0, 0.28);',
			'    animation: dsh-mobile-ux-scrim 280ms ease;',
			'  }',
			'  @keyframes dsh-mobile-ux-scrim { from { opacity: 0; } to { opacity: 1; } }',
			'  @media (prefers-reduced-motion: reduce) {',
			'    [data-dsh-mobile-frame] > [data-dsh-mobile-drawer] { transition: none; }',
			'    [data-dsh-mobile-frame]:not([data-sidebar-collapsed])::after { animation: none; }',
			'  }',
			'}',
			/* ---------------------------------------------------------------------
			   Settings panel (mobile). The shipped panel is a centred 800px dialog with a
			   188px navigation column beside the body. On a phone it fills the screen and
			   turns vertical: the column becomes a title bar whose category list scrolls
			   horizontally as pills, and the section body takes the remaining height.
			   Anchored on data-shortcut-modal="settings" and plain child tags rather than
			   the built class names, which change hash on every build.
			   --------------------------------------------------------------------- */
			'@media (max-width: 1023px) {',
			'  [data-shortcut-modal="settings"] {',
			'    box-sizing: border-box;',
			'    width: 100% !important;',
			'    max-width: none !important;',
			'    height: 100% !important;',
			'    max-height: none !important;',
			'    border-radius: 0 !important;',
			'    flex-direction: column !important;',
			'    position: relative !important;',
			'  }',
			/* Title bar: the padding clears the notch; the close button floats at its right. */
			'  [data-shortcut-modal="settings"] > nav {',
			'    box-sizing: border-box;',
			'    width: 100% !important;',
			'    flex: none !important;',
			'    gap: 8px !important;',
			'    padding: calc(env(safe-area-inset-top, 0px) + 12px) 12px 0 !important;',
			'    border-bottom: 0.5px solid var(--dsw-alias-border-l3);',
			'  }',
			'  [data-shortcut-modal="settings"] > nav > div:first-child {',
			'    padding: 0 44px 0 4px !important;',
			'    font-size: 17px !important;',
			'    line-height: 24px !important;',
			'  }',
			/* Categories: one horizontally scrollable row of pills. */
			'  [data-shortcut-modal="settings"] > nav > div:last-child {',
			'    flex-direction: row !important;',
			'    align-items: center !important;',
			'    gap: 6px !important;',
			'    padding: 2px 0 10px !important;',
			'    overflow-x: auto !important;',
			'    overflow-y: hidden !important;',
			'    overscroll-behavior-x: contain;',
			'    scrollbar-width: none;',
			'    -webkit-overflow-scrolling: touch;',
			'  }',
			'  [data-shortcut-modal="settings"] > nav > div:last-child::-webkit-scrollbar { display: none; }',
			'  [data-shortcut-modal="settings"] > nav > div:last-child > button {',
			'    flex: none !important;',
			'    height: 32px !important;',
			'    padding: 5px 12px !important;',
			'    gap: 6px !important;',
			'    border-radius: 999px !important;',
			'    border: 0.5px solid var(--dsw-alias-border-l3) !important;',
			'    background: transparent !important;',
			'    font-size: 13px !important;',
			'    line-height: 20px !important;',
			'  }',
			'  [data-shortcut-modal="settings"] > nav > div:last-child > button[aria-current="true"] {',
			'    background: var(--dsw-alias-interactive-bg-hover) !important;',
			'    border-color: transparent !important;',
			'    font-weight: 500 !important;',
			'  }',
			/* Body: header actions and the close button move up into the title bar. */
			'  [data-shortcut-modal="settings"] > div {',
			'    flex: 1 !important;',
			'    min-height: 0 !important;',
			'  }',
			'  [data-shortcut-modal="settings"] > div > div:first-child {',
			'    position: absolute !important;',
			'    top: calc(env(safe-area-inset-top, 0px) + 8px) !important;',
			'    right: 10px !important;',
			'    height: auto !important;',
			'    padding: 0 !important;',
			'    gap: 6px !important;',
			'    align-items: center !important;',
			'    z-index: 2;',
			'  }',
			'  [data-shortcut-modal="settings"] > div > div:last-child {',
			'    padding: 14px 16px calc(20px + env(safe-area-inset-bottom, 0px)) !important;',
			'  }',
			'}'
		].join('\n');

		/** True on any narrow viewport: the frame's own collapse breakpoint. */
		const isNarrow = () => window.matchMedia(MOBILE_MEDIA).matches;
		/** True on a touch-driven device, where Enter must insert a line break. */
		const isTouch = () => window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

		const frameElement = () => document.querySelector('[data-dsh-mobile-frame]');

		/** Whether the drawer is currently revealed. */
		const drawerOpen = () => {
			const frame = frameElement();
			return frame !== null && !frame.hasAttribute('data-sidebar-collapsed');
		};

		return {
			inject: ['layout'],
			/**
			 * Install the mobile stylesheet, column marks, gestures and key handling.
			 * @param ctx - Client root context, with the layout panel service injected.
			 */
			apply(ctx) {
				badge('UX v9: apply', '#2563eb');
				probe('apply');
				ctx.effect(() => {
					let disabled = false;
					let marksSettled = false;
					let suppressClickUntil = 0;
					const style = document.createElement('style');
					style.setAttribute('data-dsh-mobile-ux', '');
					style.textContent = CSS;
					document.head.appendChild(style);

					/**
					 * Identify the sidebar and center columns by their built class names and
					 * tag them plus the frame. DOM order is deliberately not used: the right
					 * column's occupant is conditional, which makes sibling arithmetic wrong.
					 * @returns whether every mark is now in place.
					 */
					const markFrame = () => {
						if (disabled) return true;
						if (!isNarrow()) return false;
						const overlay = document.querySelector('[data-shell-overlay]');
						const frame = overlay === null ? null : overlay.parentElement;
						if (frame === null) return false;
						if (frame.hasAttribute('data-dsh-mobile-frame')) return true;
						const columns = Array.prototype.filter.call(frame.children, (el) => el.tagName === 'DIV');
						const byClass = (suffix) => columns.find((el) => (el.getAttribute('class') || '').includes(suffix));
						const drawer = byClass(DRAWER_CLASS);
						const center = byClass(CENTER_CLASS);
						const rightbar = byClass(RIGHTBAR_CLASS);
						if (drawer === void 0 || center === void 0 || drawer === center) return false;
						if (drawer.parentElement !== frame || center.parentElement !== frame) return false;
						drawer.setAttribute('data-dsh-mobile-drawer', '');
						center.setAttribute('data-dsh-mobile-center', '');
						/* The right column is optional: its absence must not block the marks. */
						if (rightbar !== void 0 && rightbar !== drawer && rightbar !== center) {
							rightbar.setAttribute('data-dsh-mobile-rightbar', '');
						}
						frame.setAttribute('data-dsh-mobile-frame', '');
						badge('UX v9: ready', '#16a34a');
						probe('ready');
						return true;
					};

					/** Drop the marks but keep the stylesheet, so a later resize can re-mark. */
					const clearMarks = () => {
						marksSettled = false;
						const frame = frameElement();
						if (frame === null) return;
						frame.removeAttribute('data-dsh-mobile-frame');
						const center = frame.querySelector('[data-dsh-mobile-center]');
						const drawer = frame.querySelector('[data-dsh-mobile-drawer]');
						const rightbar = frame.querySelector('[data-dsh-mobile-rightbar]');
						if (center !== null) center.removeAttribute('data-dsh-mobile-center');
						if (drawer !== null) drawer.removeAttribute('data-dsh-mobile-drawer');
						if (rightbar !== null) rightbar.removeAttribute('data-dsh-mobile-rightbar');
					};

					/** Remove every mark and the stylesheet, leaving the shipped layout intact. */
					const disable = () => {
						disabled = true;
						observer.disconnect();
						window.clearTimeout(firstCheck);
						window.clearTimeout(secondCheck);
						window.clearTimeout(resizeTimer);
						window.removeEventListener('resize', onResize);
						clearMarks();
						style.remove();
						badge('UX v9: self-disable', '#dc2626');
						probe('selfdisable');
						console.warn('[dsh-mobile-ux] layout self-check failed; mobile drawer disabled on this page.');
					};

					/**
					 * Prove the marked conversation column is still on screen. Called after the marks
					 * settle and after a resize; a single bad reading is retried, because the first
					 * frames of a page load can still be unsettled. Only a column that is plainly
					 * gone (no height, display/visibility off, or narrower than a phone control rail)
					 * is treated as broken, and even then the geometry is reported first.
					 */
					let verifyFailures = 0;
					const verify = () => {
						if (disabled) return;
						const frame = frameElement();
						if (frame === null) return;
						const center = frame.querySelector('[data-dsh-mobile-center]');
						if (center === null) {
							probe('verify-missing');
							disable();
							return;
						}
						const rect = center.getBoundingClientRect();
						const computed = window.getComputedStyle(center);
						const broken = rect.height === 0
							|| rect.width < 120
							|| computed.visibility === 'hidden'
							|| computed.display === 'none';
						if (!broken) {
							verifyFailures = 0;
							probe('verify-ok');
							return;
						}
						verifyFailures += 1;
						if (verifyFailures === 1) {
							window.setTimeout(verify, 1200);
							return;
						}
						probe('verify-broken');
						disable();
					};

					const observer = new MutationObserver(() => {
						if (disabled || marksSettled) return;
						marksSettled = markFrame();
						if (marksSettled) observer.disconnect();
					});
					/** Mark when possible, and re-evaluate after viewport changes. */
					const retryMark = () => {
						if (disabled) return;
						if (!isNarrow()) {
							clearMarks();
							badge('UX v9: wide w=' + window.innerWidth, '#a16207');
							probe('wide');
							return;
						}
						if (marksSettled) {
							verify();
							return;
						}
						marksSettled = markFrame();
						if (marksSettled) observer.disconnect();
						else observer.observe(document.documentElement, { childList: true, subtree: true });
					};
					let resizeTimer = 0;
					const onResize = () => {
						window.clearTimeout(resizeTimer);
						resizeTimer = window.setTimeout(retryMark, 200);
					};
					window.addEventListener('resize', onResize);
					retryMark();
					const firstCheck = window.setTimeout(verify, 800);
					const secondCheck = window.setTimeout(verify, 3000);
					/* Temporary: report the outcome, and drop the badge once nothing is wrong. */
					const report = window.setTimeout(() => {
						if (disabled) return;
						if (marksSettled) {
							const el = document.getElementById('dsh-mobile-ux-badge');
							if (el !== null) el.remove();
							return;
						}
						badge('UX v9: no-frame w=' + window.innerWidth + ' narrow=' + isNarrow(), '#dc2626');
						probe('noframe');
					}, 2500);

					/** Ask the frame service to reach the requested drawer state. */
					const setDrawer = (open) => {
						if (drawerOpen() !== open) ctx.layout.toggleSidebar();
					};

					/* --- Swipe gesture (touch) ------------------------------------- */
					let touch = null;
					const onTouchStart = (event) => {
						touch = null;
						if (disabled || !isNarrow() || frameElement() === null) return;
						if (event.touches.length !== 1) return;
						const point = event.touches[0];
						const open = drawerOpen();
						/* Closed: only a left-edge start may open the drawer. */
						if (!open && point.clientX > EDGE_START) return;
						touch = { x: point.clientX, y: point.clientY, open, horizontal: false };
					};
					const onTouchMove = (event) => {
						if (touch === null) return;
						if (event.touches.length !== 1) {
							touch = null;
							return;
						}
						const point = event.touches[0];
						const dx = point.clientX - touch.x;
						const dy = point.clientY - touch.y;
						if (!touch.horizontal) {
							if (Math.abs(dx) < DIRECTION_SLOP && Math.abs(dy) < DIRECTION_SLOP) return;
							if (Math.abs(dx) > Math.abs(dy) * 1.4) touch.horizontal = true;
							else {
								touch = null;
								return;
							}
						}
						/* The gesture is ours now: keep the browser from scrolling or navigating. */
						if (event.cancelable) event.preventDefault();
					};
					const onTouchEnd = (event) => {
						const started = touch;
						touch = null;
						if (disabled || started === null || !started.horizontal) return;
						const point = event.changedTouches[0];
						if (point === void 0) return;
						settleGesture(started, point.clientX, point.clientY);
					};
					const onTouchCancel = () => {
						touch = null;
					};

					/* --- Drag gesture (mouse or pen) ------------------------------- */
					let drag = null;
					const onPointerDown = (event) => {
						drag = null;
						if (event.pointerType === 'touch') return;
						if (disabled || !isNarrow() || frameElement() === null) return;
						const open = drawerOpen();
						if (!open && event.clientX > EDGE_START) return;
						drag = { x: event.clientX, y: event.clientY, open, horizontal: false };
					};
					const onPointerMove = (event) => {
						if (drag === null) return;
						const dx = event.clientX - drag.x;
						const dy = event.clientY - drag.y;
						if (!drag.horizontal) {
							if (Math.abs(dx) < DIRECTION_SLOP && Math.abs(dy) < DIRECTION_SLOP) return;
							if (Math.abs(dx) > Math.abs(dy) * 1.4) drag.horizontal = true;
							else drag = null;
						}
					};
					const onPointerUp = (event) => {
						const started = drag;
						drag = null;
						if (disabled || started === null || !started.horizontal) return;
						settleGesture(started, event.clientX, event.clientY);
					};
					const onPointerCancel = () => {
						drag = null;
					};

					/**
					 * Commit a finished gesture: reach the drawer state its direction asks for,
					 * and keep the trailing click from immediately undoing it.
					 * @param started - gesture origin, holding the drawer state at its start.
					 * @param x - final client x.
					 * @param y - final client y.
					 */
					function settleGesture(started, x, y) {
						const dx = x - started.x;
						const dy = y - started.y;
						if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return;
						suppressClickUntil = Date.now() + CLICK_SUPPRESS;
						if (!started.open && dx > 0) setDrawer(true);
						else if (started.open && dx < 0) setDrawer(false);
					}

					/* --- Tap dismisses the drawer ------------------------------- */
					/**
					 * Any tap while the drawer is open dismisses it: a conversation outside it,
					 * the scrim, or the conversation area. Deferred to a timeout so the frame's own
					 * control (the sidebar's collapse button) can close it first without us
					 * toggling it back open.
					 */
					const onClick = () => {
						if (disabled || !isNarrow() || !drawerOpen()) return;
						if (Date.now() < suppressClickUntil) return;
						window.setTimeout(() => {
							if (!disabled && drawerOpen()) setDrawer(false);
						}, 0);
					};

					/* --- Enter inserts a line break ------------------------------- */
					/**
					 * A phone keyboard has no Shift key, so the composer's own Enter shortcut
					 * would submit. Intercept the key before Lexical sees it and insert the line
					 * break its Shift+Enter path would have inserted.
					 */
					const onKeyDown = (event) => {
						if (disabled || !isNarrow() || !isTouch()) return;
						if (event.key !== 'Enter' || event.defaultPrevented) return;
						if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
						if (event.isComposing || event.keyCode === 229) return;
						if (!(event.target instanceof Element)) return;
						if (event.target.closest('[data-lexical-editor="true"]') === null) return;
						event.preventDefault();
						event.stopImmediatePropagation();
						if (!document.execCommand('insertLineBreak')) document.execCommand('insertText', false, '\n');
					};

					document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
					document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
					document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
					document.addEventListener('touchcancel', onTouchCancel, { capture: true, passive: true });
					document.addEventListener('pointerdown', onPointerDown, true);
					document.addEventListener('pointermove', onPointerMove, true);
					document.addEventListener('pointerup', onPointerUp, true);
					document.addEventListener('pointercancel', onPointerCancel, true);
					document.addEventListener('click', onClick, true);
					document.addEventListener('keydown', onKeyDown, true);

					return () => {
						disabled = true;
						observer.disconnect();
						window.clearTimeout(firstCheck);
						window.clearTimeout(secondCheck);
						window.clearTimeout(resizeTimer);
						window.clearTimeout(report);
						window.removeEventListener('resize', onResize);
						document.removeEventListener('touchstart', onTouchStart, true);
						document.removeEventListener('touchmove', onTouchMove, true);
						document.removeEventListener('touchend', onTouchEnd, true);
						document.removeEventListener('touchcancel', onTouchCancel, true);
						document.removeEventListener('pointerdown', onPointerDown, true);
						document.removeEventListener('pointermove', onPointerMove, true);
						document.removeEventListener('pointerup', onPointerUp, true);
						document.removeEventListener('pointercancel', onPointerCancel, true);
						document.removeEventListener('click', onClick, true);
						document.removeEventListener('keydown', onKeyDown, true);
						style.remove();
						clearMarks();
						const el = document.getElementById('dsh-mobile-ux-badge');
						if (el !== null) el.remove();
					};
				});
			}
		};
	}
});
