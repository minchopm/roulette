const TouchDndPolyfill = {
    longPressDelay: 250,

    isDragging: false,
    sourceElement: null,
    ghostElement: null,
    pressTimer: null,
    lastTarget: null,

    dataTransfer: {
        data: {},
        setData(format, value) { this.data[format] = value; },
        getData(format) { return this.data[format]; },
        clearData() { this.data = {}; }
    },

    init() {
        document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    },


    onTouchStart(event) {
        const element = event.target.closest('[draggable="true"]');
        if (!element) return;

        this.sourceElement = element;

        this.pressTimer = setTimeout(() => {
            event.preventDefault();
            this.isDragging = true;
            this.dataTransfer.clearData();

            this.dispatchEvent(this.sourceElement, 'dragstart', event.touches[0]);

            this.createGhost(event.touches[0]);

            document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
            document.addEventListener('touchend', this.onTouchEnd.bind(this));
            document.addEventListener('touchcancel', this.onTouchCancel.bind(this));
        }, this.longPressDelay);
    },

    onTouchMove(event) {
        if (this.pressTimer) {
            clearTimeout(this.pressTimer);
            this.pressTimer = null;
        }

        if (!this.isDragging) return;

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
        if (this.pressTimer) {
            clearTimeout(this.pressTimer);
            this.pressTimer = null;
        }

        if (this.isDragging) {
            const touch = event.changedTouches[0];

            if (this.lastTarget) {
                this.dispatchEvent(this.lastTarget, 'drop', touch);
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
        if (this.pressTimer) clearTimeout(this.pressTimer);
        this.pressTimer = null;

        if (this.ghostElement) {
            this.ghostElement.remove();
            this.ghostElement = null;
        }

        document.removeEventListener('touchmove', this.onTouchMove.bind(this));
        document.removeEventListener('touchend', this.onTouchEnd.bind(this));
        document.removeEventListener('touchcancel', this.onTouchCancel.bind(this));
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
