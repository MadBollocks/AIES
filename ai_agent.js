class AIAgent {
    constructor(size, observe) {
        this.size = size;
        this.observe = observe;
        this.reset();
    }

    reset() {
        this.knownSafe = new Set(['1,1']);
        this.visited = new Set();
        this.knownDanger = new Set();
        this.parent = new Map();
        this.lastPosition = null;
        this.hasGold = false;
    }

    key(position) {
        return `${position.x},${position.y}`;
    }

    parseKey(key) {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
    }

    inBounds(position) {
        return position.x >= 1 && position.x <= this.size &&
            position.y >= 1 && position.y <= this.size;
    }

    neighbors(position) {
        return [
            { x: position.x, y: position.y + 1, action: 'up' },
            { x: position.x + 1, y: position.y, action: 'right' },
            { x: position.x, y: position.y - 1, action: 'down' },
            { x: position.x - 1, y: position.y, action: 'left' }
        ].filter(position => this.inBounds(position));
    }

    directionTo(next, current) {
        if (next.x > current.x) return 'right';
        if (next.x < current.x) return 'left';
        if (next.y > current.y) return 'up';
        return 'down';
    }

    learn(observation) {
        const current = observation.position;
        const currentKey = this.key(current);
        const percepts = observation.percepts;

        this.visited.add(currentKey);
        this.knownSafe.add(currentKey);
        this.hasGold = observation.hasGold;

        // If the current cell has neither warning, all adjacent cells are safe.
        // This is a valid deduction from the game's percept rules.
        if (!percepts.breeze && !percepts.stench) {
            for (const neighbor of this.neighbors(current)) {
                const key = this.key(neighbor);
                this.knownSafe.add(key);
                this.knownDanger.delete(key);
                if (!this.parent.has(key) && key !== '1,1') {
                    this.parent.set(key, currentKey);
                }
            }
        }

        // Store local warnings for memory/debugging. The agent does not inspect
        // the actual pit or Wumpus locations.
        if (percepts.breeze || percepts.stench) {
            for (const neighbor of this.neighbors(current)) {
                const key = this.key(neighbor);
                if (!this.knownSafe.has(key)) this.knownDanger.add(key);
            }
        }
    }

    shortestKnownSafePath(start, goalKey) {
        const startKey = this.key(start);
        if (startKey === goalKey) return [];

        const queue = [startKey];
        const previous = new Map([[startKey, null]]);

        while (queue.length) {
            const currentKey = queue.shift();
            const current = this.parseKey(currentKey);

            for (const neighbor of this.neighbors(current)) {
                const nextKey = this.key(neighbor);
                if (!this.knownSafe.has(nextKey) || previous.has(nextKey)) continue;

                previous.set(nextKey, currentKey);
                if (nextKey === goalKey) {
                    const path = [];
                    let cursor = goalKey;
                    while (cursor !== startKey) {
                        path.unshift(this.parseKey(cursor));
                        cursor = previous.get(cursor);
                    }
                    return path;
                }
                queue.push(nextKey);
            }
        }

        return null;
    }

    findNextFrontier(current) {
        // Find the nearest known-safe cell that has not yet been visited.
        const startKey = this.key(current);
        const queue = [startKey];
        const previous = new Map([[startKey, null]]);

        while (queue.length) {
            const currentKey = queue.shift();

            if (currentKey !== startKey && !this.visited.has(currentKey)) {
                const path = [];
                let cursor = currentKey;
                while (cursor !== startKey) {
                    path.unshift(this.parseKey(cursor));
                    cursor = previous.get(cursor);
                }
                return path;
            }

            const position = this.parseKey(currentKey);
            for (const neighbor of this.neighbors(position)) {
                const nextKey = this.key(neighbor);
                if (!this.knownSafe.has(nextKey) || previous.has(nextKey)) continue;
                previous.set(nextKey, currentKey);
                queue.push(nextKey);
            }
        }

        return null;
    }

    nextAction() {
        const observation = this.observe();
        if (!observation || observation.finished) return null;

        this.learn(observation);

        const current = observation.position;
        const currentKey = this.key(current);

        if (observation.percepts.glitter) return 'grab';

        if (observation.hasGold) {
            if (currentKey === '1,1') return 'escape';

            const pathHome = this.shortestKnownSafePath(current, '1,1');
            if (pathHome && pathHome.length) {
                return this.directionTo(pathHome[0], current);
            }
            return null;
        }

        const frontierPath = this.findNextFrontier(current);
        if (frontierPath && frontierPath.length) {
            return this.directionTo(frontierPath[0], current);
        }

        // No more known-safe unexplored cells. In generated maps, the gold is
        // on the guaranteed safe route, so this indicates an unexpected state.
        return null;
    }

    static plan(world, algorithm) {
        const start = { x: 1, y: 1 };
        const goal = world.gold;
        const safe = position => !world.isHazard(position);
        const result = algorithm === 'astar'
            ? this.aStarPath(world, start, goal, safe)
            : this.bruteForcePath(world, start, goal, safe);
        const outbound = result.path;
        const returnPath = [...outbound.slice(0, -1).reverse(), start];

        return {
            actions: outbound.map((position, index) => {
                const current = index ? outbound[index - 1] : start;
                return this.directionTo(position, current);
            }).concat(['grab']).concat(
                returnPath.map((position, index) => {
                    const current = index ? returnPath[index - 1] : goal;
                    return this.directionTo(position, current);
                })
            ).concat(['escape']),
            pathLength: outbound.length + returnPath.length,
            nodesExpanded: result.nodesExpanded,
            backtracks: result.backtracks || 0
        };
    }

    static directionTo(next, current) {
        if (next.x > current.x) return 'right';
        if (next.x < current.x) return 'left';
        if (next.y > current.y) return 'up';
        return 'down';
    }

    static aStarPath(world, start, goal, safe) {
        const key = position => world.key(position);
        const heuristic = position => Math.abs(position.x - goal.x) + Math.abs(position.y - goal.y);
        const open = [{ position: start, g: 0, f: heuristic(start) }];
        const previous = new Map();
        const costs = new Map([[key(start), 0]]);
        let nodesExpanded = 0;

        while (open.length) {
            open.sort((left, right) => left.f - right.f);
            const current = open.shift().position;
            const currentKey = key(current);
            nodesExpanded++;
            if (currentKey === key(goal)) {
                return { ...this.reconstructPath(previous, start, goal), nodesExpanded };
            }

            for (const next of world.neighbors(current)) {
                if (!safe(next)) continue;
                const nextKey = key(next);
                const nextCost = costs.get(currentKey) + 1;
                if (nextCost >= (costs.get(nextKey) ?? Infinity)) continue;
                costs.set(nextKey, nextCost);
                previous.set(nextKey, current);
                open.push({ position: next, g: nextCost, f: nextCost + heuristic(next) });
            }
        }

        return { path: [], nodesExpanded };
    }

    static bruteForcePath(world, start, goal, safe) {
        const goalKey = world.key(goal);
        const visited = new Set();
        const path = [];
        let nodesExpanded = 0;
        let backtracks = 0;

        const search = position => {
            const positionKey = world.key(position);
            visited.add(positionKey);
            path.push(position);
            nodesExpanded++;
            if (positionKey === goalKey) return true;

            for (const next of world.neighbors(position)) {
                if (!safe(next) || visited.has(world.key(next))) continue;
                if (search(next)) return true;
            }

            path.pop();
            visited.delete(positionKey);
            backtracks++;
            return false;
        };

        search(start);
        return { path: path.slice(), nodesExpanded, backtracks };
    }

    static reconstructPath(previous, start, goal) {
        const path = [];
        let cursor = goal;
        while (worldKey(cursor) !== worldKey(start)) {
            path.unshift(cursor);
            cursor = previous.get(worldKey(cursor));
        }
        return { path, nodesExpanded: 0 };

        function worldKey(position) {
            return `${position.x},${position.y}`;
        }
    }
}

window.AIAgent = AIAgent;
