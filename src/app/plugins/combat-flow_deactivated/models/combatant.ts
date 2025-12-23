import { SyncObject, SyncVar } from '@udonarium/core/synchronize-object/decorator';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';

@SyncObject('combatant')
export class Combatant extends ObjectNode {
  @SyncVar() characterId: string = '';
  @SyncVar() initiative: number = 0;
  @SyncVar() hasActed: boolean = false;
  @SyncVar() statusEffectIds: string[] = []; // StatusEffectオブジェクトのIDを保持
}
