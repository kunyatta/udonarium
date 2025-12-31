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
  @SyncVar() anchor: string = 'center'; // 'center' | 'bottom' | 'bottom-left' etc.
  @SyncVar() isClickToClose: boolean = true;
  @SyncVar() label: string = '';
  @SyncVar() imageIdentifier: string = ''; // Used for persistence in SaveDataService
  @SyncVar() imageName: string = '';
  @SyncVar() ownerPeerId: string = '';

  // New Properties for Media Support
  @SyncVar() videoIdentifier: string = ''; // YouTube Video ID, etc.
  @SyncVar() sourceType: string = 'udonarium-image'; // 'udonarium-image' | 'youtube-video' | 'direct-text'
  @SyncVar() isLocal: boolean = false; // If true, this object is not synced via P2P (conceptually)
  @SyncVar() expirationTime: number = 0; // Timestamp when this object should be destroyed
  @SyncVar() isDebug: boolean = false; // If true, show debug info in UI

  // Animation Properties
  @SyncVar() transitionDuration: number = 0; // ms
  @SyncVar() transitionEasing: string = 'ease'; // 'ease', 'linear', 'ease-in-out', 'cubic-bezier(...)', etc.

  /**
   * 自分がこのオブジェクトの所有者（作成者）であるかどうか。
   */
  get isMine(): boolean {
    return PeerCursor.myCursor && this.ownerPeerId === PeerCursor.myCursor.peerId;
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