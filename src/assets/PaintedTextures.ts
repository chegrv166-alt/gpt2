import type Phaser from 'phaser';
import materialsURL from './art/materials.png';
import propsURL from './art/props.png';
import actorsURL from './art/actors.png';
import { ACTORS, ACTOR_IDS, ACTOR_STATES, DIRECTIONS, DIRECTION_VECTORS, FRAME_COUNT, actorTextureKey } from './catalog';
import type { ActorId, ActorState, Direction } from './catalog';

export const ART_SOURCES = {
  'painted-materials': materialsURL,
  'painted-props': propsURL,
  'painted-actors': actorsURL,
} as const;

type Point = readonly [number, number];
type Context = CanvasRenderingContext2D;

export interface ActorCutout {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}

/** Recover the sixteen actual silhouettes, independent of the atlas grid gutters. */
export function segmentActorAtlas(width: number, height: number, pixels: Uint8ClampedArray): readonly ActorCutout[] {
  const length = width * height;
  if (pixels.length !== length * 4) throw new Error('Invalid painted actor pixel dimensions');
  const labels = new Int32Array(length);
  const queue = new Int32Array(length);
  const components: { id: number; count: number; left: number; right: number; top: number; bottom: number }[] = [];
  const visitNeighbors = (index: number, visit: (neighbor: number) => void): void => {
    const x = index % width; const y = Math.floor(index / width);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
      visit(index + dy * width + dx);
    }
  };
  for (let start = 0; start < length; start++) {
    if (labels[start] || pixels[start * 4 + 3]! < 12) continue;
    const component = { id: components.length + 1, count: 0, left: width, right: 0, top: height, bottom: 0 };
    let head = 0; let tail = 1; queue[0] = start; labels[start] = component.id;
    while (head < tail) {
      const index = queue[head++]!;
      const x = index % width; const y = Math.floor(index / width);
      component.count++;
      component.left = Math.min(component.left, x); component.right = Math.max(component.right, x);
      component.top = Math.min(component.top, y); component.bottom = Math.max(component.bottom, y);
      visitNeighbors(index, (neighbor) => {
        if (!labels[neighbor] && pixels[neighbor * 4 + 3]! >= 12) {
          labels[neighbor] = component.id; queue[tail++] = neighbor;
        }
      });
    }
    components.push(component);
  }
  const bodies = components.sort((a, b) => b.count - a.count).slice(0, 16);
  if (bodies.length !== 16 || bodies.some((body) => body.count < length / 500)) {
    throw new Error('Painted actor atlas must contain sixteen complete character silhouettes');
  }
  bodies.sort((a, b) => (a.top + a.bottom) - (b.top + b.bottom));
  const ordered = Array.from({ length: 4 }, (_, row) => bodies.slice(row * 4, row * 4 + 4)
    .sort((a, b) => (a.left + a.right) - (b.left + b.right))).flat();
  const owners = new Map(ordered.map((body, i) => [body.id, i + 1]));
  const distances = new Uint8Array(length); distances.fill(255);
  let head = 0; let tail = 0;
  for (let index = 0; index < length; index++) {
    labels[index] = owners.get(labels[index]!) ?? 0;
    if (labels[index]) { distances[index] = 0; queue[tail++] = index; }
  }
  // A short nearest-owner fringe restores antialiasing and detached paint flecks.
  // Never use the alpha1 background haze to bridge neighboring characters.
  while (head < tail) {
    const index = queue[head++]!;
    if (distances[index]! >= 3) continue;
    visitNeighbors(index, (neighbor) => {
      if (distances[neighbor] !== 255) return;
      distances[neighbor] = distances[index]! + 1;
      labels[neighbor] = labels[index]!;
      queue[tail++] = neighbor;
    });
  }
  return ordered.map((body, ownerIndex) => {
    const left = Math.max(0, body.left - 3); const top = Math.max(0, body.top - 3);
    const right = Math.min(width, body.right + 4); const bottom = Math.min(height, body.bottom + 4);
    const cutoutWidth = right - left; const cutoutHeight = bottom - top;
    const output = new Uint8ClampedArray(cutoutWidth * cutoutHeight * 4);
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const index = y * width + x;
      if (labels[index] !== ownerIndex + 1) continue;
      const source = index * 4; const target = ((y - top) * cutoutWidth + x - left) * 4;
      output[target] = pixels[source]!; output[target + 1] = pixels[source + 1]!;
      output[target + 2] = pixels[source + 2]!; output[target + 3] = pixels[source + 3]!;
    }
    return { left, top, width: cutoutWidth, height: cutoutHeight, pixels: output };
  });
}

function canvas(width: number, height: number): HTMLCanvasElement {
  const result = document.createElement('canvas');
  result.width = width; result.height = height;
  return result;
}

function polygon(context: Context, points: readonly Point[], fill?: string): void {
  context.beginPath();
  points.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
  context.closePath();
  if (fill) { context.fillStyle = fill; context.fill(); }
}

/** One pixel read per atlas; all frame baking reuses the extracted cells. */
class Atlas {
  private readonly image: HTMLCanvasElement;
  private readonly pixels: Uint8ClampedArray;

  public constructor(scene: Phaser.Scene, key: keyof typeof ART_SOURCES) {
    if (!scene.textures.exists(key)) throw new Error(`Missing painted atlas: ${key}`);
    const source = scene.textures.get(key).getSourceImage();
    if (!source.width || !source.height) throw new Error(`Invalid painted atlas: ${key}`);
    this.image = canvas(source.width, source.height);
    const context = this.image.getContext('2d')!;
    context.drawImage(source as CanvasImageSource, 0, 0);
    this.pixels = context.getImageData(0, 0, source.width, source.height).data;
  }

  public actorCells(): readonly HTMLCanvasElement[] {
    return segmentActorAtlas(this.image.width, this.image.height, this.pixels).map((cutout) => {
      const result = canvas(cutout.width, cutout.height);
      const context = result.getContext('2d')!;
      const image = context.createImageData(cutout.width, cutout.height);
      image.data.set(cutout.pixels); context.putImageData(image, 0, 0);
      return result;
    });
  }

  public cell(column: number, row: number, columns: number, rows: number, tight = false): HTMLCanvasElement {
    let left = Math.floor(column * this.image.width / columns);
    let right = Math.floor((column + 1) * this.image.width / columns);
    let top = Math.floor(row * this.image.height / rows);
    let bottom = Math.floor((row + 1) * this.image.height / rows);
    if (tight) {
      let minX = right; let maxX = left; let minY = bottom; let maxY = top;
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        if (this.pixels[(y * this.image.width + x) * 4 + 3]! < 12) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      if (minX > maxX || minY > maxY) throw new Error(`Empty painted atlas cell ${column},${row}`);
      left = minX; right = maxX + 1; top = minY; bottom = maxY + 1;
    }
    const result = canvas(right - left, bottom - top);
    result.getContext('2d')!.drawImage(this.image, left, top, right - left, bottom - top, 0, 0, result.width, result.height);
    return result;
  }
}

/** Replace the procedural texture contract with locally bundled painted art. */
export class PaintedTextures {
  private static readonly baked = new WeakSet<Phaser.Textures.TextureManager>();

  public constructor(private readonly scene: Phaser.Scene) {}

  public bakeAll(): void {
    if (PaintedTextures.baked.has(this.scene.textures)) return;
    const materials = new Atlas(this.scene, 'painted-materials');
    const props = new Atlas(this.scene, 'painted-props');
    const actors = new Atlas(this.scene, 'painted-actors');
    const slate = materials.cell(0, 0, 2, 2);
    const masonry = materials.cell(1, 0, 2, 2);
    const basalt = materials.cell(0, 1, 2, 2);
    const earth = materials.cell(1, 1, 2, 2);
    for (const [kind, material] of [['stone', slate], ['ground', earth], ['crypt', basalt]] as const) {
      for (let variant = 0; variant < 4; variant++) this.bake(`tile-${kind}-${variant}`, 128, 80,
        (context) => this.floor(context, material, variant));
    }
    for (const crypt of [false, true]) for (const side of ['nw', 'ne'] as const) {
      this.bake(`wall-${crypt ? 'crypt-' : ''}${side}`, 128, 144,
        (context) => this.wall(context, masonry, side, crypt));
    }
    const propSizes = [{ key: 'rock', height: 65, width: 110 }, { key: 'pillar', height: 110, width: 68 },
      { key: 'brazier', height: 90, width: 80 }, { key: 'sconce', height: 94, width: 68 }] as const;
    propSizes.forEach((spec, index) => {
      const art = props.cell(index % 2, Math.floor(index / 2), 2, 2, true);
      const scale = Math.min(spec.height / art.height, spec.width / art.width);
      this.bake(`prop-${spec.key}`, 128, 144, (context) => {
        context.drawImage(art, 64 - art.width * scale / 2, 114 - art.height * scale, art.width * scale, art.height * scale);
      });
    });
    const actorCells = actors.actorCells();
    ACTOR_IDS.forEach((actor, row) => {
      const art = actorCells.slice(row * 4, row * 4 + 4);
      for (const state of ACTOR_STATES) for (const direction of DIRECTIONS) for (let frame = 0; frame < FRAME_COUNT; frame++) {
        const spec = ACTORS[actor];
        this.bake(actorTextureKey(actor, state, direction, frame), spec.width, spec.height,
          (context) => this.actor(context, art, actor, state, direction, frame));
      }
    });
    PaintedTextures.baked.add(this.scene.textures);
  }

  private bake(key: string, width: number, height: number, paint: (context: Context) => void): void {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const texture = this.scene.textures.createCanvas(key, width, height);
    if (!texture) throw new Error(`Cannot create painted texture: ${key}`);
    const context = texture.context;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    paint(context);
    texture.refresh();
  }

  /** Affine projection keeps the stone grain on the diamond, including its edges. */
  private floor(context: Context, material: HTMLCanvasElement, variant: number): void {
    polygon(context, [[2, 34], [64, 65], [64, 73], [2, 42]], '#222521');
    polygon(context, [[64, 65], [126, 34], [126, 42], [64, 73]], '#151b1b');
    context.save();
    polygon(context, [[64, 3], [126, 34], [64, 65], [2, 34]]); context.clip();
    context.transform(62, 31, -62, 31, 64, 3);
    const size = Math.floor(material.width * 0.76);
    const margin = material.width - size;
    context.drawImage(material, (variant % 2) * margin, Math.floor(variant / 2) * margin, size, size, 0, 0, 1, 1);
    context.restore();
    context.strokeStyle = 'rgba(195,185,153,.25)'; context.lineWidth = 0.8;
    context.beginPath(); context.moveTo(3, 34); context.lineTo(64, 3.7); context.lineTo(125, 34); context.stroke();
  }

  private surface(context: Context, material: HTMLCanvasElement, points: readonly Point[], shade: string): void {
    const [a, b, , d] = points;
    if (!a || !b || !d) return;
    context.save(); polygon(context, points); context.clip();
    context.transform(b[0] - a[0], b[1] - a[1], d[0] - a[0], d[1] - a[1], a[0], a[1]);
    context.drawImage(material, 0, 0, 1, 1);
    context.fillStyle = shade; context.fillRect(0, 0, 1, 1);
    context.restore();
  }

  private wall(context: Context, material: HTMLCanvasElement, side: 'nw' | 'ne', crypt: boolean): void {
    this.surface(context, material, [[2, 37], [64, 68], [64, 114], [2, 83]],
      side === 'nw' ? 'rgba(16,24,31,.2)' : 'rgba(13,20,29,.38)');
    this.surface(context, material, [[64, 68], [126, 37], [126, 83], [64, 114]],
      side === 'ne' ? 'rgba(16,24,31,.2)' : 'rgba(13,20,29,.38)');
    this.surface(context, material, [[64, 6], [126, 37], [64, 68], [2, 37]],
      crypt ? 'rgba(34,28,45,.27)' : 'rgba(151,145,124,.14)');
    context.save(); context.globalCompositeOperation = 'source-atop';
    const weather = context.createLinearGradient(0, 20, 0, 116);
    weather.addColorStop(0, crypt ? 'rgba(54,53,78,.16)' : 'rgba(173,171,146,.08)');
    weather.addColorStop(1, 'rgba(9,16,14,.35)');
    context.fillStyle = weather; context.fillRect(0, 0, 128, 144); context.restore();
    context.strokeStyle = 'rgba(215,205,173,.33)'; context.lineWidth = 1;
    context.beginPath(); context.moveTo(3, 37); context.lineTo(64, 6); context.lineTo(125, 37); context.stroke();
    context.strokeStyle = 'rgba(20,22,20,.55)';
    context.beginPath(); context.moveTo(64, 68); context.lineTo(64, 113); context.stroke();
  }

  private actor(context: Context, arts: readonly HTMLCanvasElement[], actor: ActorId, state: ActorState, direction: Direction, frame: number): void {
    const columns: Record<Direction, number> = { e: 0, se: 0, s: 1, sw: 1, w: 2, nw: 2, n: 3, ne: 3 };
    const art = arts[columns[direction]]!;
    const definition = ACTORS[actor];
    const targetHeight = { hero: 85, grunt: 79, caster: 86, boss: 111 }[actor];
    const scale = Math.min(targetHeight / art.height, (actor === 'boss' ? 120 : 90) / art.width);
    const width = art.width * scale; const height = art.height * scale;
    const phase = frame * Math.PI / 2;
    const [dx, dy] = DIRECTION_VECTORS[direction];
    const cardinal = direction.length === 1;
    const attack = state === 'attack' ? [0, 0.035, 0.075, 0.018][frame]! : 0;
    const bob = state === 'walk' ? (frame % 2) * 1.4 : state === 'idle' ? (Math.sin(phase) + 1) * 0.32 : 0;
    const recoil = state === 'hurt' ? [-2.2, 1.1, -0.8, 0.2][frame]! : 0;
    const sway = state === 'walk' ? Math.sin(phase) * 0.9 : Math.sin(phase) * 0.18;
    context.save();
    context.translate(definition.width / 2 + recoil + sway + dx * attack * 24, definition.footY - bob);
    context.transform(cardinal ? 0.94 : 1, 0, (cardinal ? dx * 0.055 : 0) + dx * attack, 1, 0, 0);
    context.scale(1 + Math.cos(phase) * (state === 'walk' ? 0.009 : 0.003),
      1 + Math.cos(phase) * (state === 'idle' ? 0.003 : -0.006));
    // Small lower-cloak displacement preserves the painted pose and grounded feet.
    const bands = 8;
    for (let band = 0; band < bands; band++) {
      const sourceY = art.height * band / bands;
      const sourceHeight = art.height / bands;
      const cloak = Math.sin(phase + band * 0.65) * (band > 3 && band < 7 ? 0.45 : 0.08);
      context.drawImage(art, 0, sourceY, art.width, Math.min(sourceHeight + 0.6, art.height - sourceY),
        -width / 2 + cloak, -height + height * band / bands, width, height / bands + 0.2);
    }
    if (state === 'attack' && frame > 0) {
      const radius = actor === 'boss' ? 51 : 37;
      const centerY = -height * 0.44 + dy * 4;
      const start = Math.atan2(dy * 0.6, dx) - 1.05 + frame * 0.21;
      context.lineCap = 'round';
      context.strokeStyle = actor === 'caster' ? `rgba(174,142,211,${[0, 0.14, 0.52, 0.18][frame]})`
        : `rgba(220,191,135,${[0, 0.12, 0.45, 0.14][frame]})`;
      context.lineWidth = frame === 2 ? 3.1 : 1.7;
      context.beginPath(); context.ellipse(0, centerY, radius, radius * 0.47, 0, start, start + 1.5); context.stroke();
      context.strokeStyle = 'rgba(246,226,184,.65)'; context.lineWidth = 0.65;
      if (frame === 2) { context.beginPath(); context.ellipse(0, centerY, radius - 1, radius * 0.47, 0, start + 0.2, start + 1.4); context.stroke(); }
    }
    context.restore();
    if (state === 'hurt') {
      context.save(); context.globalCompositeOperation = 'source-atop';
      context.fillStyle = `rgba(223,143,115,${[0.24, 0.16, 0.09, 0.035][frame]})`;
      context.fillRect(0, 0, definition.width, definition.height); context.restore();
    }
  }
}
