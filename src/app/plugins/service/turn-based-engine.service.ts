import { Injectable } from '@angular/core';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { DataElement } from '@udonarium/data-element';

@Injectable({ providedIn: 'root' })
export class TurnBasedEngineService {

  constructor() { }

  // --- リスト操作API ---
  addParticipant(container: PluginDataContainer, id: string): void {
    const idsRoot = this.findOrCreateIdsRoot(container);
    // 重複チェック
    const existing = idsRoot.children.find(child => 
      (child as DataElement).getFirstElementByName('id')?.value === id
    );
    if (existing) return;

    // <participant><id>...</id><hasActed>...</hasActed></participant>
    const participant = DataElement.create('participant', '', {});
    participant.appendChild(DataElement.create('id', id, {}));
    participant.appendChild(DataElement.create('hasActed', 'false', {}));
    idsRoot.appendChild(participant);
  }

  removeParticipant(container: PluginDataContainer, id: string): void {
    const idsRoot = this.findOrCreateIdsRoot(container);
    const target = idsRoot.children.find(child => 
      (child as DataElement).getFirstElementByName('id')?.value === id
    );
    if (target) {
      idsRoot.removeChild(target);
    }
  }

  // --- 進行管理API ---
  nextTurn(container: PluginDataContainer): void {
    const engineRoot = this.findOrCreateEngineRoot(container);
    const isPlaying = engineRoot.getFirstElementByName('isPlaying');
    if (!isPlaying || isPlaying.value !== 'true') return;

    const idsRoot = this.findOrCreateIdsRoot(container);
    const participants = idsRoot.children;

    if (participants.length === 0) return;

    const currentIndexElem = engineRoot.getFirstElementByName('currentIndex');
    let newIndex = (Number(currentIndexElem.value) || 0) + 1;

    if (newIndex >= participants.length) {
      this.startNewRound(container);
    } else {
      currentIndexElem.value = newIndex;
    }
  }

  prevTurn(container: PluginDataContainer): void {
    const engineRoot = this.findOrCreateEngineRoot(container);
    const isPlaying = engineRoot.getFirstElementByName('isPlaying');
    if (!isPlaying || isPlaying.value !== 'true') return;

    const idsRoot = this.findOrCreateIdsRoot(container);
    const participants = idsRoot.children;

    if (participants.length === 0) return;

    const currentIndexElem = engineRoot.getFirstElementByName('currentIndex');
    const roundElem = engineRoot.getFirstElementByName('round');
    let currentRound = Number(roundElem.value) || 1;
    let newIndex = (Number(currentIndexElem.value) || 0) - 1;

    if (newIndex < 0) {
      if (currentRound > 1) {
        roundElem.value = currentRound - 1;
        currentIndexElem.value = participants.length - 1;
      } else {
        currentIndexElem.value = 0;
      }
    } else {
      currentIndexElem.value = newIndex;
    }
  }

  setRound(container: PluginDataContainer, round: number): void {
    const engineRoot = this.findOrCreateEngineRoot(container);
    engineRoot.getFirstElementByName('round').value = Math.max(1, round);
  }

  nextRound(container: PluginDataContainer): void {
    this.startNewRound(container);
  }

  start(container: PluginDataContainer): void {
    const engineRoot = this.findOrCreateEngineRoot(container);
    const isPlaying = engineRoot.getFirstElementByName('isPlaying');
    isPlaying.value = 'true';

    const currentIndex = engineRoot.getFirstElementByName('currentIndex');
    currentIndex.value = 0;

    const round = engineRoot.getFirstElementByName('round');
    if (!round.value) round.value = 1;
  }

  stop(container: PluginDataContainer): void {
    const engineRoot = this.findOrCreateEngineRoot(container);
    engineRoot.getFirstElementByName('isPlaying').value = 'false';
  }

  reset(container: PluginDataContainer): void {
    const engineRoot = this.findOrCreateEngineRoot(container);
    engineRoot.getFirstElementByName('currentIndex').value = 0;
    engineRoot.getFirstElementByName('round').value = 1;

    // participantIdsリストをクリア
    const idsRoot = this.findOrCreateIdsRoot(container);
    // コピーしてから削除しないとイテレータが壊れる可能性があるため
    [...idsRoot.children].forEach(child => idsRoot.removeChild(child));
  }

  private startNewRound(container: PluginDataContainer): void {
    const engineRoot = this.findOrCreateEngineRoot(container);
    const roundElem = engineRoot.getFirstElementByName('round');
    roundElem.value = (Number(roundElem.value) || 0) + 1;
    engineRoot.getFirstElementByName('currentIndex').value = 0;
    
    // 行動済みフラグのリセット
    const idsRoot = this.findOrCreateIdsRoot(container);
    idsRoot.children.forEach(p => {
      const hasActed = (p as DataElement).getFirstElementByName('hasActed');
      if (hasActed) hasActed.value = 'false';
    });
  }
  
  // --- 状態操作API ---
  
  toggleHasActed(container: PluginDataContainer, id: string): void {
    const idsRoot = this.findOrCreateIdsRoot(container);
    const target = idsRoot.children.find(child => 
      (child as DataElement).getFirstElementByName('id')?.value === id
    );
    if (target) {
      const hasActed = (target as DataElement).getFirstElementByName('hasActed');
      if (hasActed) {
        hasActed.value = hasActed.value === 'true' ? 'false' : 'true';
      }
    }
  }
  
  setTurnToCharacter(container: PluginDataContainer, id: string): void {
    const idsRoot = this.findOrCreateIdsRoot(container);
    const index = idsRoot.children.findIndex(child => 
      (child as DataElement).getFirstElementByName('id')?.value === id
    );
    if (index !== -1) {
      const engineRoot = this.findOrCreateEngineRoot(container);
      engineRoot.getFirstElementByName('currentIndex').value = index;
    }
  }

  // engine-state要素を探す/作るヘルパー
  private findOrCreateEngineRoot(container: PluginDataContainer): DataElement {
    let root = container.state.getFirstElementByName('engine-state');
    if (!root) {
      root = DataElement.create('engine-state', '', {});
      container.state.appendChild(root);

      // 初期データ構造を作成
      root.appendChild(DataElement.create('isPlaying', 'false', {}));
      root.appendChild(DataElement.create('currentIndex', 0, {}));
      root.appendChild(DataElement.create('round', 1, {}));
      root.appendChild(DataElement.create('participantIds', '', {}));
    }
    return root;
  }

  private findOrCreateIdsRoot(container: PluginDataContainer): DataElement {
    const engineRoot = this.findOrCreateEngineRoot(container);
    let idsRoot = engineRoot.getFirstElementByName('participantIds');
    if (!idsRoot) {
      idsRoot = DataElement.create('participantIds', '', {});
      engineRoot.appendChild(idsRoot);
    }
    return idsRoot;
  }

  // --- 並べ替えAPI ---
  
  moveParticipantUp(container: PluginDataContainer, characterId: string): void {
    const idsRoot = this.findOrCreateIdsRoot(container);
    const children = [...idsRoot.children];
    const index = children.findIndex(child => 
       (child as DataElement).getFirstElementByName('id')?.value === characterId
    );

    if (index > 0) {
      // 配列上で入れ替え
      const target = children[index];
      children.splice(index, 1);
      children.splice(index - 1, 0, target);
      
      // DOM上で再配置（一度削除してから追加し直すのが確実）
      children.forEach(child => idsRoot.removeChild(child));
      children.forEach(child => idsRoot.appendChild(child));
    }
  }

  moveParticipantDown(container: PluginDataContainer, characterId: string): void {
    const idsRoot = this.findOrCreateIdsRoot(container);
    const children = [...idsRoot.children];
    const index = children.findIndex(child => 
       (child as DataElement).getFirstElementByName('id')?.value === characterId
    );

    if (index >= 0 && index < children.length - 1) {
      // 配列上で入れ替え
      const target = children[index];
      children.splice(index, 1);
      children.splice(index + 1, 0, target);
      
      // DOM上で再配置
      children.forEach(child => idsRoot.removeChild(child));
      children.forEach(child => idsRoot.appendChild(child));
    }
  }
}