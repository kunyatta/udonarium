import { SyncObject, SyncVar } from '@udonarium/core/synchronize-object/decorator';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';
import { EventSystem } from '@udonarium/core/system';

export type VoteType = 'roll-call' | 'poll';

@SyncObject('roll-call-vote')
export class Vote extends ObjectNode {
  @SyncVar() title: string = '点呼';
  @SyncVar() isRunning: boolean = false;
  @SyncVar() ownerId: string = ''; // 点呼を開始した人のPeerId
  @SyncVar() type: VoteType = 'roll-call';
  @SyncVar() includeOwner: boolean = true;
  @SyncVar() private _choices: string = '[]'; // JSON string of string[]

  get choices(): string[] {
    try {
      return JSON.parse(this._choices);
    } catch (e) {
      return [];
    }
  }

  set choices(values: string[]) {
    this._choices = JSON.stringify(values);
  }

  get entries(): VoteEntry[] {
    return this.children as VoteEntry[];
  }

  startActivity(type: VoteType, title: string, ownerId: string, includeOwner: boolean, choices: string[] = []) {
    this.title = title;
    this.ownerId = ownerId;
    this.type = type;
    this.includeOwner = includeOwner;
    this.choices = choices;
    this.isRunning = true;
    
    // 既存のエントリーをクリア
    for (const child of this.children) {
      child.destroy();
    }
    
    EventSystem.trigger('ROLL_CALL_START', { voteIdentifier: this.identifier });
  }

  stopActivity() {
    this.isRunning = false;
    EventSystem.trigger('ROLL_CALL_END', { voteIdentifier: this.identifier });
  }

  answer(peerId: string, name: string, state: number) {
    let entry = this.entries.find(e => e.peerId === peerId);
    if (!entry) {
      entry = new VoteEntry();
      entry.initialize();
      this.appendChild(entry);
    }
    entry.peerId = peerId;
    entry.name = name;
    entry.state = state;
  }

  // PeerIDに基づいた回答状況を取得
  getAnswerState(peerId: string): number {
    const entry = this.entries.find(e => e.peerId === peerId);
    return entry ? entry.state : 0; // 0: 未回答
  }

  // startRollCall / stopRollCall は互換性のため残すか削除するかだが、
  // 今回は修正範囲が明確なので削除し、新しいメソッドに統一する。
  // ただし、Service側で吸収するため、ここではメソッド名を変更した。
}

@SyncObject('roll-call-vote-entry')
export class VoteEntry extends ObjectNode {
  @SyncVar() peerId: string = '';
  @SyncVar() name: string = '';
  @SyncVar() state: number = 0; // 点呼: 1=出席, 投票: 1~N=選択肢インデックス
}
