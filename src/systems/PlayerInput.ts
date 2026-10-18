import Phaser from 'phaser';
import type { Vec2 } from '../math/isometric';

interface InputActions {
  readonly primary: (screenWorld: Vec2, force: boolean) => void;
  readonly skill: (screenWorld: Vec2 | null) => void;
  readonly cancel: (fromBlur?: boolean) => void;
  readonly reset: () => void;
  readonly map: () => void;
  readonly inventory: () => void;
  readonly interact: () => void;
}

const MOVEMENT_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

export class PlayerInput {
  private readonly pressed = new Set<string>();
  private readonly input: Phaser.Input.InputPlugin;
  private pointerSeen = false;

  public constructor(private readonly scene: Phaser.Scene, private readonly actions: InputActions) {
    this.input = scene.input;
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.pointerDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.pointerMove);
    scene.input.mouse?.disableContextMenu();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  public get axis(): Vec2 {
    const up = this.pressed.has('KeyW') || this.pressed.has('ArrowUp');
    const down = this.pressed.has('KeyS') || this.pressed.has('ArrowDown');
    const left = this.pressed.has('KeyA') || this.pressed.has('ArrowLeft');
    const right = this.pressed.has('KeyD') || this.pressed.has('ArrowRight');
    return { x: Number(right) - Number(left), y: Number(down) - Number(up) };
  }

  public clear(): void {
    this.pressed.clear();
  }

  public destroy(): void {
    this.clear();
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.pointerDown);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.pointerMove);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  private readonly keyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (MOVEMENT_CODES.has(event.code)) {
      event.preventDefault();
      this.pressed.add(event.code);
    } else if (!event.repeat && ['Escape', 'KeyR', 'KeyM', 'KeyQ', 'KeyI', 'KeyE'].includes(event.code)) {
      event.preventDefault();
      if (event.code === 'Escape') {
        this.clear();
        this.actions.cancel();
      } else if (event.code === 'KeyI') this.actions.inventory();
      else if (event.code === 'KeyE') this.actions.interact();
      else if (event.code === 'KeyQ') this.actions.skill(this.pointerAim());
      else if (event.code === 'KeyR') this.actions.reset();
      else this.actions.map();
    }
  };

  private readonly keyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private readonly blur = (): void => {
    this.clear();
    this.actions.cancel(true);
  };

  private readonly pointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.pointerSeen = true;
    const point = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (pointer.rightButtonDown()) this.actions.skill({ x: point.x, y: point.y });
    else if (pointer.leftButtonDown()) this.actions.primary({ x: point.x, y: point.y }, pointer.event instanceof MouseEvent && pointer.event.shiftKey);
  };

  private readonly pointerMove = (): void => { this.pointerSeen = true; };

  private pointerAim(): Vec2 | null {
    const pointer = this.input.activePointer;
    if (!this.pointerSeen || pointer.x < 0 || pointer.y < 0 || pointer.x > this.scene.scale.width || pointer.y > this.scene.scale.height) return null;
    const point = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: point.x, y: point.y };
  }
}
