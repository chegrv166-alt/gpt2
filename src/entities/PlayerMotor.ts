import { directionFromScreen, isoToScreen, screenVectorToIso } from '../math/isometric';
import type { Vec2 } from '../math/isometric';
import type { Direction } from '../assets/catalog';
import type { CollisionGrid } from '../world/CollisionGrid';
import { findPath } from '../world/pathfinding';

export type MovementMode = 'idle' | 'keyboard' | 'path';

export class PlayerMotor {
  public position: Vec2;
  public velocity: Vec2 = { x: 0, y: 0 };
  public direction: Direction = 'se';
  public state: 'idle' | 'walk' = 'idle';
  public mode: MovementMode = 'idle';
  public readonly radius: number;
  public speed: number;
  private waypoints: Vec2[] = [];

  public constructor(private readonly grid: CollisionGrid, start: Vec2, options = { speed: 3.4, radius: 0.22 }) {
    if (!Number.isFinite(options.speed) || options.speed <= 0 || options.radius <= 0 || !grid.canOccupy(start, options.radius)) {
      throw new Error('Invalid player motor configuration or spawn position');
    }
    this.position = { ...start };
    this.radius = options.radius;
    this.speed = options.speed;
  }

  public get path(): readonly Vec2[] {
    return this.waypoints;
  }

  public setDestination(target: Vec2): boolean {
    const route = findPath(this.grid, this.position, target, this.radius);
    this.stop();
    if (!route) return false;
    this.waypoints = route;
    this.mode = route.length > 0 ? 'path' : 'idle';
    return true;
  }

  public tick(deltaSeconds: number, screenInput: Vec2): void {
    const seconds = Math.max(0, Math.min(deltaSeconds, 0.25));
    if (!Number.isFinite(seconds) || seconds === 0) return;
    const before = this.position;
    let remaining = seconds;
    while (remaining > 0.000001) {
      const step = Math.min(remaining, 1 / 60);
      this.integrate(step, screenInput);
      remaining -= step;
    }
    this.velocity = { x: (this.position.x - before.x) / seconds, y: (this.position.y - before.y) / seconds };
    this.state = Math.hypot(this.velocity.x, this.velocity.y) > 0.00001 ? 'walk' : 'idle';
  }

  private integrate(seconds: number, screenInput: Vec2): void {
    const keyboard = Math.hypot(screenInput.x, screenInput.y) > 0;
    if (keyboard) {
      this.waypoints = [];
      this.mode = 'keyboard';
      const ground = screenVectorToIso(screenInput);
      this.direction = directionFromScreen(screenInput, this.direction);
      this.position = this.grid.move(this.position, {
        x: ground.x * this.speed * seconds, y: ground.y * this.speed * seconds,
      }, this.radius);
    } else if (this.waypoints.length > 0) {
      let budget = this.speed * seconds;
      while (budget > 0.000001 && this.waypoints.length > 0) {
        const target = this.waypoints[0];
        if (!target) break;
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 0.00001) {
          this.position = target;
          this.waypoints.shift();
          continue;
        }
        this.direction = directionFromScreen(isoToScreen({ x: dx, y: dy }), this.direction);
        const step = Math.min(budget, distance);
        const desired = { x: this.position.x + dx / distance * step, y: this.position.y + dy / distance * step };
        this.position = this.grid.move(this.position, { x: dx / distance * step, y: dy / distance * step }, this.radius);
        budget -= step;
        if (Math.hypot(this.position.x - desired.x, this.position.y - desired.y) > 0.00001) {
          this.waypoints = [];
          break;
        }
        if (distance <= step + 0.000001) {
          this.position = { ...target };
          this.waypoints.shift();
        }
      }
      this.mode = this.waypoints.length > 0 ? 'path' : 'idle';
    } else {
      this.mode = 'idle';
    }
  }

  public stop(): void {
    this.waypoints = [];
    this.mode = 'idle';
    this.state = 'idle';
    this.velocity = { x: 0, y: 0 };
  }

  public pause(): void {
    this.state = 'idle';
    this.velocity = { x: 0, y: 0 };
  }

  public setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0) throw new Error('Move speed must be finite and positive');
    this.speed = speed;
  }

  public reset(position: Vec2): void {
    if (!this.grid.canOccupy(position, this.radius)) throw new Error('Cannot place the player inside a collider');
    this.stop();
    this.position = { ...position };
    this.direction = 'se';
  }
}
