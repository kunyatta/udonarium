import { Component } from '@angular/core';
import { OverlayTestPlugin } from '../overlay-test-plugin.service';
import { OverlayObject } from '../../overlay-object';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { ModalService } from 'service/modal.service';
import { FileSelecterComponent } from 'component/file-selecter/file-selecter.component';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';

@Component({
  selector: 'app-overlay-controller',
  templateUrl: './overlay-controller.component.html',
  styleUrls: ['./overlay-controller.component.css']
})
export class OverlayControllerComponent {

  // UI Bindings
  initial = { x: 120, y: 50, opacity: 0, scale: 1.0 };
  target = { x: 50, y: 50, opacity: 1, scale: 1.0 };
  anim = { duration: 500, easing: 'ease-out' };

  easings = [
    'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'
  ];
  
  get targetObject(): OverlayObject {
    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    return objects.length > 0 ? objects[objects.length - 1] : null;
  }

  constructor(
    private overlayPlugin: OverlayTestPlugin,
    private modalService: ModalService
  ) {}

  createStanding(label: string) {
    // 既存オブジェクトがあれば削除（サンドボックスなので1つに絞る）
    this.destroyAll();
    // 初期状態を反映して作成
    const obj = this.overlayPlugin.createTestOverlay('standing', label);
    // 初期値をUIの値で上書き
    obj.transitionDuration = 0;
    obj.left = this.initial.x;
    obj.top = this.initial.y;
    obj.opacity = this.initial.opacity;
    obj.scale = this.initial.scale;
  }

  destroyAll() {
    this.overlayPlugin.clearAll();
  }

  selectImage() {
    if (!this.targetObject) return;
    this.modalService.open<string>(FileSelecterComponent, { isAllowedEmpty: false }).then(identifier => {
      if (identifier) {
        const imageFile = ImageStorage.instance.get(identifier);
        if (imageFile) {
          this.targetObject.imageIdentifier = identifier; // セット！
          this.targetObject.imageName = imageFile.name;
          this.targetObject.update();
        }
      }
    });
  }

  setInitialState() {
    if (!this.targetObject) return;
    // 瞬間移動
    this.targetObject.transitionDuration = 0;
    this.targetObject.left = this.initial.x;
    this.targetObject.top = this.initial.y;
    this.targetObject.opacity = this.initial.opacity;
    this.targetObject.scale = this.initial.scale;
  }

  playAnimation() {
    if (!this.targetObject) return;
    
    // もし type が video の場合は videoIdentifier を使う（ダミー用）
    if (this.targetObject.type === 'video') {
      this.targetObject.videoIdentifier = 'dQw4w9WgXcQ'; // ダミーID
    }

    this.targetObject.transitionDuration = this.anim.duration;
    this.targetObject.transitionEasing = this.anim.easing;
    
    this.targetObject.left = this.target.x;
    this.targetObject.top = this.target.y;
    this.targetObject.opacity = this.target.opacity;
    this.targetObject.scale = this.target.scale;
  }
}