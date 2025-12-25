import { SyncObject, SyncVar } from '@udonarium/core/synchronize-object/decorator';
import { GameObject } from '@udonarium/core/synchronize-object/game-object';

@SyncObject('overlay-test')
export class OverlayTestObject extends GameObject {
  @SyncVar() left: number = 50;
  @SyncVar() top: number = 50;
  @SyncVar() opacity: number = 1.0;

  // 識別用の名前（将来的に複数出す場合のため）
  @SyncVar() label: string = 'Test Object';
}
