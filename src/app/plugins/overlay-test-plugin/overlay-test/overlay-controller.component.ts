import { Component, OnInit } from '@angular/core';
import { OverlayTestPlugin } from '../overlay-test-plugin.service';
import { OverlayTestObject } from '../overlay-test-object';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';

@Component({
  selector: 'app-overlay-controller',
  templateUrl: './overlay-controller.component.html',
  styleUrls: ['./overlay-controller.component.css']
})
export class OverlayControllerComponent {
  
  // 操作対象のオブジェクトを特定する（今回は簡単のため最初の1つ）
  get targetObject(): OverlayTestObject {
    return ObjectStore.instance.getObjects<OverlayTestObject>(OverlayTestObject)[0];
  }

  get hasOverlay(): boolean {
    return !!this.targetObject;
  }

  constructor(private overlayPlugin: OverlayTestPlugin) {}

  createOverlay() {
    this.overlayPlugin.createOverlay(50, 50, 1.0);
  }

  destroyOverlay() {
    this.overlayPlugin.clearAll();
  }

  // スライダー操作時に GameObject の値を直接書き換える
  // これだけで P2P 同期が走り、全員の View が更新される
  updateParams() {
    // ゲッターを介して直接値を書き換える（@SyncVarにより自動同期される）
  }
}