const TouchDndPolyfill = {
    // We no longer need a long press delay. Instead, we use a threshold.
    // This is the number of pixels the finger must move before a drag starts.
    // It prevents accidental drags when the user just wants to tap.
    dragThreshold: 5,

    // --- State properties ---
    isDragging: false,      // Is a drag operation currently in progress?
    sourceElement: null,    // The element where the touch started
    ghostElement: null,     // The floating element that follows the finger
    lastTarget: null,       // The last element the finger was over

    // Initial touch coordinates
    startX: 0,
    startY: 0,

    // We store pre-bound versions of our event handlers
    // to ensure `removeEventListener` works correctly.
    boundOnTouchMove: null,
    boundOnTouchEnd: null,
    boundOnTouchCancel: null,

    dataTransfer: {
        data: {},
        setData(format, value) { this.data[format] = value; },
        getData(format) { return this.data[format]; },
        clearData() { this.data = {}; }
    },

    init() {
        // Pre-bind event handlers to `this`
        this.boundOnTouchMove = this.onTouchMove.bind(this);
        this.boundOnTouchEnd = this.onTouchEnd.bind(this);
        this.boundOnTouchCancel = this.onTouchCancel.bind(this);

        document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    },


    onTouchStart(event) {
        // Find the draggable element the user touched
        const element = event.target.closest('[draggable="true"]');
        if (!element || this.isDragging) return;

        this.sourceElement = element;
        const touch = event.touches[0];
        this.startX = touch.clientX;
        this.startY = touch.clientY;

        // Add move and end listeners to the whole document.
        // The drag won't start yet, but we're ready for it.
        document.addEventListener('touchmove', this.boundOnTouchMove, { passive: false });
        document.addEventListener('touchend', this.boundOnTouchEnd);
        document.addEventListener('touchcancel', this.boundOnTouchCancel);
    },

    onTouchMove(event) {
        if (!this.sourceElement) return;

        // --- DRAG INITIATION LOGIC ---
        // If we aren't dragging yet, check if the finger has moved past the threshold
        if (!this.isDragging) {
            const touch = event.touches[0];
            const dx = Math.abs(touch.clientX - this.startX);
            const dy = Math.abs(touch.clientY - this.startY);

            if (Math.sqrt(dx*dx + dy*dy) < this.dragThreshold) {
                // Not moved enough, so do nothing.
                return;
            }

            // Threshold passed! Start the drag.
            this.isDragging = true;
            this.dataTransfer.clearData();
            // Dispatch the 'dragstart' event so the main script can react
            this.dispatchEvent(this.sourceElement, 'dragstart', touch);
            // Create the visual ghost element
            this.createGhost(touch);
        }

        // This part runs on every move event *after* the drag has started
        event.preventDefault(); // Prevent page scrolling

        const touch = event.touches[0];

        // Move the ghost element
        if (this.ghostElement) {
            this.ghostElement.style.left = `${touch.clientX - (this.ghostElement.offsetWidth / 2)}px`;
            this.ghostElement.style.top = `${touch.clientY - (this.ghostElement.offsetHeight / 2)}px`;
        }

        // --- DRAG OVER/ENTER/LEAVE LOGIC ---
        // Temporarily hide the ghost to find the element underneath
        if (this.ghostElement) this.ghostElement.style.display = 'none';
        const currentTarget = document.elementFromPoint(touch.clientX, touch.clientY);
        if (this.ghostElement) this.ghostElement.style.display = '';

        if (currentTarget !== this.lastTarget) {
            if (this.lastTarget) {
                this.dispatchEvent(this.lastTarget, 'dragleave', touch);
            }
            if (currentTarget) {
                this.dispatchEvent(currentTarget, 'dragenter', touch);
            }
            this.lastTarget = currentTarget;
        }

        if (this.lastTarget) {
            this.dispatchEvent(this.lastTarget, 'dragover', touch);
        }
    },

    onTouchEnd(event) {
        // Only do drop/dragend logic if a drag actually started
        if (this.isDragging) {
            const touch = event.changedTouches[0];

            // Find the final drop target
            if (this.ghostElement) this.ghostElement.style.display = 'none';
            const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
            if (this.ghostElement) this.ghostElement.style.display = '';

            if (dropTarget) {
                this.dispatchEvent(dropTarget, 'drop', touch);
            }

            this.dispatchEvent(this.sourceElement, 'dragend', touch);
        }

        // Always clean up state and listeners
        this.cleanup();
    },

    onTouchCancel(event) {
        this.onTouchEnd(event);
    },

    createGhost(touch) {
        if (!this.sourceElement) return;
        this.ghostElement = this.sourceElement.cloneNode(true);
        this.ghostElement.style.position = 'fixed';
        this.ghostElement.style.zIndex = '9999';
        this.ghostElement.style.opacity = '0.7';
        this.ghostElement.style.pointerEvents = 'none';
        this.ghostElement.style.width = `${this.sourceElement.offsetWidth}px`;
        this.ghostElement.style.height = `${this.sourceElement.offsetHeight}px`;
        document.body.appendChild(this.ghostElement);
    },

    cleanup() {
        this.isDragging = false;
        this.sourceElement = null;
        this.lastTarget = null;

        if (this.ghostElement) {
            this.ghostElement.remove();
            this.ghostElement = null;
        }

        // Remove the listeners we added in onTouchStart
        document.removeEventListener('touchmove', this.boundOnTouchMove);
        document.removeEventListener('touchend', this.boundOnTouchEnd);
        document.removeEventListener('touchcancel', this.boundOnTouchCancel);
    },

    dispatchEvent(target, type, touch) {
        if (!target) return;

        const event = new CustomEvent(type, { bubbles: true, cancelable: true });

        event.dataTransfer = this.dataTransfer;
        event.clientX = touch.clientX;
        event.clientY = touch.clientY;

        target.dispatchEvent(event);
    }
};
