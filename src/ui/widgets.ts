import Phaser from 'phaser';

export function label(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  text: string, size = 12, color = '#c7c6aa'): Phaser.GameObjects.Text {
  const object = scene.add.text(x, y, text, { fontFamily: 'Georgia, serif', fontSize: `${size}px`, color,
    stroke: '#101810', strokeThickness: 1 });
  parent.add(object);
  return object;
}

export function button(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  width: number, height: number, text: string, name: string, action: () => void, enabled = true): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y).setName(name);
  const background = scene.add.rectangle(0, 0, width, height, 0x242c20).setOrigin(0).setStrokeStyle(1, 0x70613f);
  root.add(background);
  label(scene, root, width / 2, height / 2, text, 13, '#d9c595').setOrigin(0.5);
  if (enabled) {
    background.setInteractive({ useHandCursor: true });
    background.on(Phaser.Input.Events.POINTER_DOWN, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); action();
    });
    background.on(Phaser.Input.Events.POINTER_OVER, () => background.setStrokeStyle(1, 0xddbd7b).setFillStyle(0x35412b));
    background.on(Phaser.Input.Events.POINTER_OUT, () => background.setStrokeStyle(1, 0x70613f).setFillStyle(0x242c20));
  } else root.setAlpha(0.4);
  parent.add(root);
  return root;
}

export function panelBackground(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, width: number, height: number): void {
  parent.add(scene.add.rectangle(0, 0, width, height, 0x141d16, 0.99).setOrigin(0).setStrokeStyle(2, 0x8e794d));
  parent.add(scene.add.rectangle(8, 8, width - 16, height - 16).setOrigin(0).setFillStyle(0, 0).setStrokeStyle(1, 0x3b4934));
}
