import type { WalkSurface } from "../contracts/index.ts";
export type CharacterState = {
    x: number;
    y: number;
    z: number;
    surfaceId: string;
};
export function createCharacterController(walk: WalkSurface, radius = .24) {
    const state: CharacterState = { ...walk.spawn };
    const attempt = (x: number, z: number) => {
        if (walk.obstacles.some((obstacle) => Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + radius))
            return;
        const sample = walk.sample(x, z, state.surfaceId);
        if (!sample || Math.abs(sample.height - state.y) > .65)
            return;
        Object.assign(state, { x, y: sample.height, z, surfaceId: sample.surfaceId });
    };
    const moveBy = (dx: number, dz: number) => {
        const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .16));
        for (let index = 0; index < count; index += 1)
            attempt(state.x + dx / count, state.z + dz / count);
    };
    return {
        state,
        moveBy,
        moveToward(x: number, z: number, maximumDistance = Infinity) {
            const dx = x - state.x;
            const dz = z - state.z;
            const distance = Math.hypot(dx, dz);
            const scale = distance > maximumDistance ? maximumDistance / distance : 1;
            moveBy(dx * scale, dz * scale);
        },
    };
}
