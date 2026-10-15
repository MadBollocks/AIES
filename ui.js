class GameUI {
    constructor() {
        this.sizeSelect = document.getElementById('grid-size');
        this.speedSelect = document.getElementById('ai-speed');
        this.board = document.getElementById('board');
        this.status = document.getElementById('status');
        this.aiStatus = document.getElementById('ai-status');
        this.score = document.getElementById('score');
        this.moves = document.getElementById('moves');
        this.goldStatus = document.getElementById('gold-status');
        this.position = document.getElementById('position');
        this.aiToggle = document.getElementById('ai-toggle');
        this.godToggle = document.getElementById('god-mode');
        this.soundToggle = document.getElementById('sound-toggle');
        this.aiTimer = null;
        this.aiRunning = false;
        this.aiSequence = false;
        this.aiPhase = null;
        this.aiPlan = null;
        this.mapSnapshot = null;
        this.godMode = false;
        this.newGame();
        this.bindEvents();
    }

    newGame() {
        this.stopAI();
        this.world = new WumpusWorld(Number(this.sizeSelect.value));
        this.agent = new AIAgent(this.world.size, () => this.world.getAgentObservation());
        this.resetComparison();
        this.render();
    }

    bindEvents() {
        document.getElementById('new-forest').addEventListener('click', () => {
            window.soundFX.init();
            this.newGame();
        });
        this.sizeSelect.addEventListener('change', () => this.newGame());
        this.aiToggle.addEventListener('click', () => {
            window.soundFX.init();
            this.aiRunning ? this.stopAI() : this.startAI();
        });
        this.godToggle.addEventListener('click', () => {
            this.godMode = !this.godMode;
            this.godToggle.textContent = `God mode: ${this.godMode ? 'On' : 'Off'}`;
            this.render();
        });
        this.soundToggle.addEventListener('click', () => {
            window.soundFX.init();
            const enabled = window.soundFX.toggleMute();
            this.soundToggle.textContent = `Sound: ${enabled ? 'On' : 'Off'}`;
        });
        this.speedSelect.addEventListener('change', () => {
            if (this.aiRunning) {
                this.stopAI();
                this.startAI();
            }
        });
        window.addEventListener('keydown', event => {
            if (event.target.matches('select, button, input')) return;
            if (event.key === 'ArrowUp') this.dispatch('up');
            if (event.key === 'ArrowRight') this.dispatch('right');
            if (event.key === 'ArrowDown') this.dispatch('down');
            if (event.key === 'ArrowLeft') this.dispatch('left');
            if (event.key === ' ') {
                event.preventDefault();
                this.dispatch('grab');
            }
            if (event.key === 'Escape') this.dispatch('escape');
        });
    }

    dispatch(action) {
        if (this.world.finished) return;
        window.soundFX.init();
        if (action === 'grab') this.world.grab();
        else if (action === 'escape') this.world.escape();
        else this.world.move(action);
        this.playEventSound();
        this.render();
        if (this.world.finished && !this.aiSequence) this.stopAI();
    }

    playEventSound() {
        if (this.world.lastEvent === 'move') window.soundFX.playStep();
        if (this.world.lastEvent === 'bump') window.soundFX.playBump();
        if (this.world.lastEvent === 'gold') window.soundFX.playGrab();
        if (this.world.lastEvent === 'death') window.soundFX.playDeath();
        if (this.world.lastEvent === 'victory') window.soundFX.playVictory();
        if (this.world.percepts.breeze) window.soundFX.playBreeze();
        if (this.world.percepts.stench) window.soundFX.playStench();
        if (this.world.percepts.glitter) window.soundFX.playGlitter();
    }

    startAI() {
        if (this.world.finished) this.newGame();
        this.mapSnapshot = this.captureMap();
        this.aiSequence = true;
        this.aiRunning = true;
        this.aiToggle.textContent = 'Pause AI';
        this.aiToggle.classList.add('active');
        this.startAlgorithm('astar');
        this.aiTimer = setInterval(() => {
            this.runAIStep();
        }, Number(this.speedSelect.value));
    }

    startAlgorithm(algorithm) {
        this.aiPhase = algorithm;
        this.aiPlan = AIAgent.plan(this.world, algorithm);
        this.updateComparison(algorithm, {
            status: 'Running',
            nodes: this.aiPlan.nodesExpanded,
            route: this.aiPlan.pathLength,
            moves: 0,
            score: 0,
            summary: algorithm === 'astar'
                ? 'A* is prioritizing the most promising cells.'
                : `Brute Force is testing branches (${this.aiPlan.backtracks} backtracks).`
        });
        this.render();
    }

    runAIStep() {
        if (!this.aiPlan || !this.aiPlan.actions.length) {
            this.finishAlgorithm();
            return;
        }
        this.dispatch(this.aiPlan.actions.shift());
        this.updateComparison(this.aiPhase, {
            moves: this.world.moves,
            score: this.world.score
        });
        if (this.world.finished) this.finishAlgorithm();
    }

    finishAlgorithm() {
        const algorithm = this.aiPhase;
        this.updateComparison(algorithm, {
            status: 'Complete',
            moves: this.world.moves,
            score: this.world.score,
            summary: algorithm === 'astar'
                ? 'Optimal route complete. Restoring this exact map for Brute Force.'
                : 'Both runs are complete. Compare search effort and route cost above.'
        });
        if (algorithm === 'astar') {
            this.restoreMap(this.mapSnapshot);
            this.startAlgorithm('bruteforce');
            return;
        }
        this.aiSequence = false;
        this.stopAI();
        this.render();
    }

    captureMap() {
        return {
            size: this.world.size,
            gold: { ...this.world.gold },
            pits: [...this.world.pits],
            wumpus: this.world.wumpus ? { ...this.world.wumpus } : null
        };
    }

    restoreMap(snapshot) {
        this.world.reset();
        this.world.gold = { ...snapshot.gold };
        this.world.pits = new Set(snapshot.pits);
        this.world.wumpus = snapshot.wumpus ? { ...snapshot.wumpus } : null;
        this.world.wumpusAlive = Boolean(this.world.wumpus);
        this.world.updatePercepts();
        this.render();
    }

    resetComparison() {
        for (const algorithm of ['astar', 'brute']) {
            this.updateComparison(algorithm, {
                status: algorithm === 'astar' ? 'Ready' : 'Waiting',
                nodes: '-', route: '-', moves: '-', score: '-',
                summary: algorithm === 'astar'
                    ? 'Shortest-path search is waiting.'
                    : 'Starts after A* finishes on this map.'
            });
        }
    }

    updateComparison(algorithm, values) {
        const prefix = algorithm === 'astar' ? 'astar' : 'brute';
        for (const [key, value] of Object.entries(values)) {
            const element = document.getElementById(`${prefix}-${key}`);
            if (element) element.textContent = value;
        }
    }

    stopAI() {
        this.aiRunning = false;
        this.aiSequence = false;
        this.aiPhase = null;
        this.aiPlan = null;
        clearInterval(this.aiTimer);
        this.aiTimer = null;
        if (this.aiToggle) {
            this.aiToggle.textContent = 'Start AI';
            this.aiToggle.classList.remove('active');
        }
    }

    render() {
        this.score.textContent = this.world.score;
        this.moves.textContent = this.world.moves;
        this.goldStatus.textContent = this.world.hasGold ? 'Yes' : 'No';
        this.status.textContent = this.world.message;
        this.position.textContent = `Position (${this.world.position.x}, ${this.world.position.y})`;
        this.aiStatus.textContent = this.aiRunning ? `${this.aiPhase === 'astar' ? 'A* Search' : 'Brute Force'} is playing` : 'AI is ready';
        this.renderBoard();
    }

    renderBoard() {
        this.board.style.gridTemplateColumns = `repeat(${this.world.size}, minmax(0, 1fr))`;
        this.board.innerHTML = '';
        for (let y = this.world.size; y >= 1; y--) {
            for (let x = 1; x <= this.world.size; x++) {
                const position = { x, y };
                const key = this.world.key(position);
                const visible = this.godMode || this.world.visited.has(key) || this.world.finished;
                const cell = document.createElement('div');
                cell.className = `cell ${visible ? 'visible' : 'hidden'}`;
                cell.innerHTML = `<small>${x},${y}</small>`;
                if (!visible) {
                    cell.innerHTML += '<span class="fog">?</span>';
                } else {
                    const icons = [];
                    if (x === this.world.position.x && y === this.world.position.y && this.world.alive) icons.push('🧭');
                    if (!this.world.hasGold && x === this.world.gold.x && y === this.world.gold.y) icons.push('🪙');
                    if (this.world.wumpus && x === this.world.wumpus.x && y === this.world.wumpus.y) icons.push(this.world.wumpusAlive ? '👹' : '💀');
                    if (this.world.pits.has(key)) icons.push('🕳');
                    if (this.world.hasBreezeAt(position)) icons.push('💨');
                    if (this.world.hasStenchAt(position)) icons.push('!');
                    cell.innerHTML += `<span class="entities">${icons.join(' ')}</span>`;
                }
                this.board.appendChild(cell);
            }
        }
    }
}

WumpusWorld.prototype.hasBreezeAt = function (position) {
    return this.neighbors(position).some(next => this.pits.has(this.key(next)));
};
WumpusWorld.prototype.hasStenchAt = function (position) {
    return this.wumpusAlive && Boolean(this.wumpus) && this.neighbors(position).some(next => this.key(next) === this.key(this.wumpus));
};

window.addEventListener('DOMContentLoaded', () => {
    window.gameUI = new GameUI();
});
