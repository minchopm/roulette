const TouchDndPolyfill = {
    dragThreshold: 5,

    isDragging: false,
    sourceElement: null,
    ghostElement: null,
    lastTarget: null,

    startX: 0,
    startY: 0,

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
        this.boundOnTouchMove = this.onTouchMove.bind(this);
        this.boundOnTouchEnd = this.onTouchEnd.bind(this);
        this.boundOnTouchCancel = this.onTouchCancel.bind(this);

        document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    },


    onTouchStart(event) {
        const element = event.target.closest('[draggable="true"]');
        if (!element || this.isDragging) return;

        this.sourceElement = element;
        const touch = event.touches[0];
        this.startX = touch.clientX;
        this.startY = touch.clientY;

        document.addEventListener('touchmove', this.boundOnTouchMove, { passive: false });
        document.addEventListener('touchend', this.boundOnTouchEnd);
        document.addEventListener('touchcancel', this.boundOnTouchCancel);
    },

    onTouchMove(event) {
        if (!this.sourceElement) return;

        if (!this.isDragging) {
            const touch = event.touches[0];
            const dx = Math.abs(touch.clientX - this.startX);
            const dy = Math.abs(touch.clientY - this.startY);

            if (Math.sqrt(dx*dx + dy*dy) < this.dragThreshold) {
                return;
            }

            this.isDragging = true;
            this.dataTransfer.clearData();
            this.dispatchEvent(this.sourceElement, 'dragstart', touch);
            this.createGhost(touch);
        }

        event.preventDefault();

        const touch = event.touches[0];

        if (this.ghostElement) {
            this.ghostElement.style.left = `${touch.clientX - (this.ghostElement.offsetWidth / 2)}px`;
            this.ghostElement.style.top = `${touch.clientY - (this.ghostElement.offsetHeight / 2)}px`;
        }

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
        if (this.isDragging) {
            const touch = event.changedTouches[0];

            if (this.ghostElement) this.ghostElement.style.display = 'none';
            const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
            if (this.ghostElement) this.ghostElement.style.display = '';

            if (dropTarget) {
                this.dispatchEvent(dropTarget, 'drop', touch);
            }

            this.dispatchEvent(this.sourceElement, 'dragend', touch);
        }

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
