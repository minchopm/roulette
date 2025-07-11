document.addEventListener('DOMContentLoaded', () => {
    TouchDndPolyfill.init();

    let selectedChipValue = 1;
    let placedChips = {};
    let moveHistory = [];

    const chipsContainer = document.querySelector('.chips-container');
    const bettingBoard = document.querySelector('.betting-board');
    const undoBtn = document.getElementById('undo-btn');
    const clearBtn = document.getElementById('clear-btn');
    const doubleBtn = document.getElementById('double-btn');
    const allChips = document.querySelectorAll('.chip');
    const allBetSpots = document.querySelectorAll('.bet-spot');

    const chipVerticalOffset = -2.5;
    const STACK_POSITIONS = {
        1: [{ top: '50%', left: '50%' }],
        2: [{ top: '50%', left: '25%' }, { top: '50%', left: '75%' }],
        3: [{ top: '25%', left: '25%' }, { top: '25%', left: '75%' }, { top: '75%', left: '25%' }]
    };

    function initialize() {
        const initialChip = chipsContainer.querySelector('.chip[data-value="1"]');
        if (initialChip) selectChip(initialChip);
        addEventListeners();
    }

    function addEventListeners() {
        chipsContainer.addEventListener('click', handleChipSelection);
        bettingBoard.addEventListener('click', handleBetPlacement);
        undoBtn.addEventListener('click', handleUndo);
        clearBtn.addEventListener('click', handleClear);
        doubleBtn.addEventListener('click', handleDouble);

        allChips.forEach(chip => {
            chip.addEventListener('dragstart', handleChipDragStart);
            chip.addEventListener('dragend', handleChipDragEnd);
        });

        allBetSpots.forEach(spot => {
            spot.addEventListener('dragover', handleDragOver);
            spot.addEventListener('dragenter', handleDragEnter);
            spot.addEventListener('dragleave', handleDragLeave);
            spot.addEventListener('drop', handleDrop);
        });

        window.addEventListener('dragover', handleWindowDragOver);
        window.addEventListener('drop', handleWindowDrop);
    }

    function selectChip(chipElement) {
        if (!chipElement) return;
        selectedChipValue = parseInt(chipElement.dataset.value, 10);
        allChips.forEach(chip => chip.classList.remove('selected'));
        chipElement.classList.add('selected');
    }

    function applyTransaction(transaction) {
        for (const move of transaction) {
            const { op, area, value, count = 1 } = move;

            for (let i = 0; i < count; i++) {
                if (op === 'add') {
                    if (!placedChips[area]) placedChips[area] = [];
                    let stack = placedChips[area].find(s => s.value === value);
                    if (stack) {
                        stack.count++;
                    } else {
                        placedChips[area].push({ value, count: 1 });
                    }
                } else if (op === 'remove') {
                    const areaStacks = placedChips[area];
                    if (!areaStacks) continue;
                    let stackToRemove = areaStacks.find(s => s.value === value);
                    if (stackToRemove) {
                        stackToRemove.count--;
                        if (stackToRemove.count === 0) {
                            placedChips[area] = areaStacks.filter(s => s.value !== value);
                        }
                    }
                    if (placedChips[area] && placedChips[area].length === 0) {
                        delete placedChips[area];
                    }
                }
            }
        }
    }

    function handleChipSelection(event) {
        const clickedChip = event.target.closest('.chip');
        selectChip(clickedChip);
    }

    function handleBetPlacement(event) {
        const betSpot = event.target.closest('.bet-spot');
        if (!betSpot) return;

        const transaction = [{ op: 'add', area: betSpot.dataset.betArea, value: selectedChipValue }];
        moveHistory.push(transaction);
        applyTransaction(transaction);
        renderBoard();
    }

    function handleClear() {
        if (Object.keys(placedChips).length === 0) return;
        placedChips = {};
        moveHistory = [];
        renderBoard();
    }

    function handleDouble() {
        if (Object.keys(placedChips).length === 0) return;
        const doubleTransaction = [];
        for (const area in placedChips) {
            placedChips[area].forEach(stack => {
                doubleTransaction.push({ op: 'add', area, value: stack.value, count: stack.count });
            });
        }
        if (doubleTransaction.length === 0) return;
        moveHistory.push(doubleTransaction);
        applyTransaction(doubleTransaction);
        renderBoard();
    }

    function handleUndo() {
        if (moveHistory.length === 0) return;
        const lastTransaction = moveHistory.pop();
        const reversedTransaction = lastTransaction.map(move => ({
            ...move,
            op: move.op === 'add' ? 'remove' : 'add'
        })).reverse();
        applyTransaction(reversedTransaction);
        renderBoard();
    }

    function handleChipDragStart(event) {
        const chip = event.target.closest('.chip');
        if (!chip) return;

        selectChip(chip);

        event.dataTransfer.setData('application/json', JSON.stringify({ type: 'new_chip', value: chip.dataset.value }));
        setTimeout(() => chip.classList.add('dragging'), 0);
    }

    function handleChipDragEnd(event) {
        const draggedItem = document.querySelector('.chip.dragging');
        if (draggedItem) draggedItem.classList.remove('dragging');
    }

    function handleStackDragStart(event) {
        event.stopPropagation();
        const stack = event.target.closest('.chip-stack');
        const sourceSpot = stack.closest('.bet-spot');
        const sourceArea = sourceSpot.dataset.betArea;
        const value = parseInt(stack.dataset.value);
        const stackData = placedChips[sourceArea].find(s => s.value === value);

        event.dataTransfer.setData('application/json', JSON.stringify({
            type: 'stack_move',
            sourceArea,
            value,
            count: stackData.count
        }));
        setTimeout(() => stack.classList.add('dragging'), 0);
    }

    function handleStackDragEnd(event) {
        const draggedItem = document.querySelector('.chip-stack.dragging');
        if (draggedItem) draggedItem.classList.remove('dragging');
    }

    function handleDragOver(event) { event.preventDefault(); }
    function handleDragEnter(event) { event.target.closest('.bet-spot')?.classList.add('drag-over'); }
    function handleDragLeave(event) { event.target.closest('.bet-spot')?.classList.remove('drag-over'); }

    function handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();

        const destSpot = event.target.closest('.bet-spot');
        if (!destSpot) return;
        destSpot.classList.remove('drag-over');
        const destArea = destSpot.dataset.betArea;

        const data = JSON.parse(event.dataTransfer.getData('application/json'));
        let transaction;

        if (data.type === 'new_chip') {
            transaction = [{ op: 'add', area: destArea, value: parseInt(data.value) }];
        } else if (data.type === 'stack_move') {
            if (data.sourceArea === destArea) return;
            transaction = [
                { op: 'remove', area: data.sourceArea, value: data.value, count: data.count },
                { op: 'add', area: destArea, value: data.value, count: data.count }
            ];
        }

        if (transaction) {
            moveHistory.push(transaction);
            applyTransaction(transaction);
            renderBoard();
        }
    }

    function handleWindowDragOver(event) {
        event.preventDefault();
    }

    function handleWindowDrop(event) {
        event.preventDefault();
        const data = JSON.parse(event.dataTransfer.getData('application/json'));

        if (data && data.type === 'stack_move') {
            const transaction = [{
                op: 'remove',
                area: data.sourceArea,
                value: data.value,
                count: data.count
            }];

            moveHistory.push(transaction);
            applyTransaction(transaction);
            renderBoard();
        }
    }


    function renderBoard() {
        document.querySelectorAll('.chip-stack').forEach(stack => stack.remove());
        for (const area in placedChips) {
            const stacksInArea = placedChips[area];
            const numStacks = stacksInArea.length;
            if (numStacks === 0) continue;

            const positionSet = STACK_POSITIONS[numStacks] || STACK_POSITIONS[3];
            const betSpots = document.querySelectorAll(`.bet-spot[data-bet-area="${area}"]`);

            betSpots.forEach(betSpot => {
                if (getComputedStyle(betSpot).display === 'none') return;
                stacksInArea.forEach((stack, index) => {
                    const { value, count } = stack;
                    if (count === 0) return;

                    const position = positionSet[index] || positionSet[positionSet.length - 1];
                    const stackContainer = document.createElement('div');
                    stackContainer.className = 'chip-stack';
                    stackContainer.dataset.value = value;
                    stackContainer.dataset.total = value * count;
                    stackContainer.style.top = position.top;
                    stackContainer.style.left = position.left;
                    stackContainer.style.setProperty('--text-offset-y', `${chipVerticalOffset * (count - 1)}px`);

                    stackContainer.draggable = true;
                    stackContainer.addEventListener('dragstart', handleStackDragStart);
                    stackContainer.addEventListener('dragend', handleStackDragEnd);

                    for (let i = 0; i < count; i++) {
                        const chipElement = document.createElement('div');
                        chipElement.className = 'chip-on-board';
                        chipElement.dataset.value = value;
                        chipElement.style.setProperty('--i', i);
                        stackContainer.appendChild(chipElement);
                    }
                    betSpot.appendChild(stackContainer);
                });
            });
        }
    }

    initialize();
});
