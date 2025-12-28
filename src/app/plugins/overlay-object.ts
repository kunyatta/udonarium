import { SyncObject, SyncVar } from '@udonarium/core/synchronize-object/decorator';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';
import { DataElement } from '@udonarium/data-element';
import { PeerCursor } from '@udonarium/peer-cursor';

/**
 * オーバーレイ演出の状態と指示を保持する同期オブジェクト。
 */
@SyncObject('overlay-object')
export class OverlayObject extends ObjectNode {
  @SyncVar() left: number = 50;
  @SyncVar() top: number = 50;
  @SyncVar() width: number = 0;
  @SyncVar() height: number = 0;
  @SyncVar() opacity: number = 1.0;
  @SyncVar() scale: number = 1.0;
  @SyncVar() zIndex: number = 2000000;
  @SyncVar() type: string = 'generic'; // 'image' | 'video' | 'text' | 'generic'
  @SyncVar() label: string = '';
  @SyncVar() imageIdentifier: string = ''; // Deprecated: Use sourceIdentifier instead
  @SyncVar() imageName: string = '';
  @SyncVar() ownerPeerId: string = '';

  // New Properties for Media Support
  @SyncVar() sourceIdentifier: string = ''; // Image Identifier or YouTube Video ID
  @SyncVar() sourceType: string = 'udonarium-image'; // 'udonarium-image' | 'youtube-video' | 'direct-text'
  @SyncVar() isLocal: boolean = false; // If true, this object is not synced via P2P (conceptually)
  @SyncVar() expirationTime: number = 0; // Timestamp when this object should be destroyed

  /**
   * 自分がこのオブジェクトの所有者（作成者）であるかどうか。
   */
  get isMine(): boolean {
    return PeerCursor.myCursor && this.ownerPeerId === PeerCursor.myCursor.peerId;
  }

  get taskQueue(): DataElement {
    return this.getFirstElementByName('taskQueue');
  }

  get content(): DataElement {
    return this.getFirstElementByName('content');
  }

  override onStoreAdded() {
    super.onStoreAdded();
    this.createRequiredElements();
    
    // 作成時に所有者が未設定なら自分をセットする
    if (!this.ownerPeerId && PeerCursor.myCursor) {
      this.ownerPeerId = PeerCursor.myCursor.peerId;
    }
  }

  createRequiredElements() {
    if (!this.getFirstElementByName('taskQueue')) {
      this.appendChild(DataElement.create('taskQueue', '', {}, 'taskQueue'));
    }
    if (!this.getFirstElementByName('content')) {
      this.appendChild(DataElement.create('content', '', {}, 'content'));
    }
  }

  private getFirstElementByName(name: string): DataElement {
    for (let child of this.children) {
      if (child instanceof DataElement && child.name === name) return child;
    }
    return null;
  }

  addTask(effectName: string, duration: number, params: any = {}) {
    const queue = this.taskQueue;
    if (!queue) return;

    const now = Date.now();
    const TTL = 30 * 1000; // 30秒

    // 新しいタスクを追加する前に、古すぎるタスクを掃除する（ゾンビ化対策）
    // P2Pなので、所有者が責任を持って掃除するのが基本だが、
    // ここで掃除することで「新しい演出をするついでにゴミ捨て」を行う
    const oldTasks = queue.children.filter(child => {
      const created = parseInt(child.getAttribute('created') as string) || 0;
      // createdがない（古い形式）か、TTLを過ぎている場合は削除対象
      return (created > 0 && now - created > TTL);
    });
    
    // 削除実行
    oldTasks.forEach(task => queue.removeChild(task));
    
    // 最大数制限も維持
    if (queue.children.length > 10) {
      while(queue.children.length > 5) {
        queue.removeChild(queue.children[0]);
      }
    }
    
    const taskName = `task_${now}_${Math.floor(Math.random() * 1000)}`;
    // created 属性を追加
    const task = DataElement.create(taskName, duration.toString(), { ...params, type: effectName, created: now }, effectName);
    
    queue.appendChild(task);
    this.update();
  }

  updateContent(name: string, value: string | number) {
    const content = this.content;
    if (!content) return;
    let element = this.getFirstElementFromNode(content, name);
    if (!element) {
      element = DataElement.create(name, value, {}, name);
      content.appendChild(element);
    } else {
      element.value = value;
    }
    this.update();
  }

  private getFirstElementFromNode(node: ObjectNode, name: string): DataElement {
    for (let child of node.children) {
      if (child instanceof DataElement && child.name === name) return child;
    }
    return null;
  }
}