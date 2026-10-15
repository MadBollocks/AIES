const GRID_SIZES = [4, 5, 6];

const MOVE_DELTAS = {
    up: { x: 0, y: 1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: -1 },
    left: { x: -1, y: 0 }
};

class WumpusWorld {
    constructor(size = 4) {
        this.size = GRID_SIZES.includes(Number(size)) ? Number(size) : 4;
        this.reset();
    }

    reset() {
        this.position = { x: 1, y: 1 };
        this.hasGold = false;
        this.alive = true;
        this.finished = false;
        this.wumpusAlive = true;
        this.score = 0;
        this.moves = 0;
        this.visited = new Set(['1,1']);
        this.message = 'Find the gold and bring it back to the entrance.';
        this.lastEvent = null;
        this.generateSolvableForest();
        this.updatePercepts();
    }

    key(position) {
        return `${position.x},${position.y}`;
    }

    inBounds(position) {
        return position.x >= 1 && position.x <= this.size &&
            position.y >= 1 && position.y <= this.size;
    }

    neighbors(position) {
        return Object.values(MOVE_DELTAS)
            .map(delta => ({ x: position.x + delta.x, y: position.y + delta.y }))
            .filter(position => this.inBounds(position));
    }

    generateSolvableForest() {
        const cells = [];
        for (let x = 1; x <= this.size; x++) {
            for (let y = 1; y <= this.size; y++) {
                if (x !== 1 || y !== 1) cells.push({ x, y });
            }
        }

        // Build a monotonic safe route from the entrance to the far corner.
        // The route is randomized, but every route cell remains safe.
        const safeRoute = [];
        let cursor = { x: 1, y: 1 };

        while (cursor.x !== this.size || cursor.y !== this.size) {
            const canMoveX = cursor.x < this.size;
            const canMoveY = cursor.y < this.size;
            const moveX = canMoveX && (!canMoveY || Math.random() < 0.5);

            cursor = moveX
                ? { x: cursor.x + 1, y: cursor.y }
                : { x: cursor.x, y: cursor.y + 1 };

            safeRoute.push({ ...cursor });
        }

        const routeKeys = new Set(
            [{ x: 1, y: 1 }, ...safeRoute].map(position => this.key(position))
        );

        // Put gold on the guaranteed route, never at the entrance.
        const goldCandidates = safeRoute.filter(
            position => !(position.x === this.size && position.y === this.size)
        );
        this.gold = { ...goldCandidates[Math.floor(Math.random() * goldCandidates.length)] };

        // Keep hazards off the route AND at least one cell away from it.
        // Therefore every route cell has no breeze or stench, and any neighbor
        // of a route cell is safe. This removes forced guesses from the solution.
        const routeNeighborhood = new Set(routeKeys);
        for (const routePosition of [{ x: 1, y: 1 }, ...safeRoute]) {
            for (const neighbor of this.neighbors(routePosition)) {
                routeNeighborhood.add(this.key(neighbor));
            }
        }

        const hazardCandidates = cells.filter(position =>
            !routeNeighborhood.has(this.key(position)) &&
            this.key(position) !== this.key(this.gold)
        );

        // Deterministic shuffle implementation is not needed for gameplay;
        // randomness only chooses the map layout, never an AI decision.
        for (let i = hazardCandidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [hazardCandidates[i], hazardCandidates[j]] = [hazardCandidates[j], hazardCandidates[i]];
        }

        this.pits = new Set();
        const pitLimit = Math.min(
            hazardCandidates.length,
            Math.max(1, Math.floor(this.size * this.size * 0.10))
        );

        for (const position of hazardCandidates) {
            if (this.pits.size >= pitLimit) break;
            if (Math.random() < 0.6) this.pits.add(this.key(position));
        }

        const wumpusPosition = hazardCandidates.find(
            position => !this.pits.has(this.key(position))
        );

        // If the map is too small to fit hazards away from the route, leave
        // the Wumpus absent rather than compromise guaranteed solvability.
        this.wumpus = wumpusPosition ? { ...wumpusPosition } : null;
        this.wumpusAlive = Boolean(this.wumpus);
    }

    isHazard(position) {
        return this.pits.has(this.key(position)) ||
            (this.wumpusAlive && this.wumpus && this.key(position) === this.key(this.wumpus));
    }

    updatePercepts() {
        const neighbors = this.neighbors(this.position);
        this.percepts = {
            breeze: neighbors.some(position => this.pits.has(this.key(position))),
            stench: this.wumpusAlive && Boolean(this.wumpus) &&
                neighbors.some(position => this.key(position) === this.key(this.wumpus)),
            glitter: !this.hasGold && this.key(this.position) === this.key(this.gold)
        };
    }

    // The AI receives only this limited observation, never the true map.
    getAgentObservation() {
        return {
            position: { ...this.position },
            size: this.size,
            hasGold: this.hasGold,
            finished: this.finished,
            alive: this.alive,
            percepts: { ...this.percepts }
        };
    }

    move(direction) {
        if (this.finished || !this.alive) return;
        const delta = MOVE_DELTAS[direction];
        if (!delta) return;

        const next = { x: this.position.x + delta.x, y: this.position.y + delta.y };
        this.moves++;
        this.score--;

        if (!this.inBounds(next)) {
            this.message = 'You hit the forest boundary.';
            this.lastEvent = 'bump';
            this.updatePercepts();
            return;
        }

        this.position = next;
        this.visited.add(this.key(next));
        this.lastEvent = 'move';

        if (this.isHazard(next)) {
            this.alive = false;
            this.finished = true;
            this.score -= 1000;
            this.message = this.pits.has(this.key(next))
                ? 'You fell into a pit.'
                : 'The Wumpus caught you.';
            this.lastEvent = 'death';
        } else {
            this.message = `Moved to (${next.x}, ${next.y}).`;
        }

        this.updatePercepts();
    }

    grab() {
        if (this.finished || !this.alive) return;
        this.moves++;
        this.score--;

        if (!this.hasGold && this.key(this.position) === this.key(this.gold)) {
            this.hasGold = true;
            this.message = 'Gold collected. Return to the entrance.';
            this.lastEvent = 'gold';
        } else {
            this.message = 'There is no gold here.';
            this.lastEvent = 'empty';
        }

        this.updatePercepts();
    }

    escape() {
        if (this.finished || !this.alive) return;
        if (this.key(this.position) !== '1,1') {
            this.message = 'Return to the entrance before leaving.';
            return;
        }
        if (!this.hasGold) {
            this.message = 'The entrance is locked until you collect the gold.';
            return;
        }

        this.finished = true;
        this.score += 1000;
        this.message = 'Victory! You escaped with the gold.';
        this.lastEvent = 'victory';
    }

    shoot() {
        if (this.finished || !this.wumpusAlive || !this.wumpus) return;
        this.wumpusAlive = false;
        this.score -= 10;
        this.message = 'The Wumpus is defeated.';
        this.lastEvent = 'arrow';
        this.updatePercepts();
    }
}

window.WumpusWorld = WumpusWorld;
window.GRID_SIZES = GRID_SIZES;
