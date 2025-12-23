import { SyncObject, SyncVar } from '@udonarium/core/synchronize-object/decorator';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';

@SyncObject('combat-state')
export class CombatState extends ObjectNode {
  @SyncVar() isCombat: boolean = false;
  @SyncVar() round: number = 1;
  @SyncVar() currentIndex: number = 0;
  @SyncVar() combatantIds: string[] = [];
  @SyncVar() displayDataTags: string = 'HP MP';
}
