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
  initial = { x: 50, y: 50, opacity: 1.0, scale: 1.0 };
  target = { x: 50, y: 50, opacity: 1, scale: 1.0 };
  anim = { duration: 500, easing: 'ease-out' };
  speechText: string = '「こんにちは！テスト台詞です」';
  speechOffset = { x: 20, y: -20 };

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
    // 既存オブジェクトがあれば削除
    this.destroyAll();
    // 'speech' タイプで作成
    const obj = this.overlayPlugin.createTestOverlay('speech', label);
    // 初期値をUIの値で上書き
    obj.transitionDuration = 0;
    obj.width = 30;  // vw
    obj.height = 10; // vh
    obj.left = this.initial.x;
    obj.top = this.initial.y;
    obj.opacity = this.initial.opacity;
    obj.scale = this.initial.scale;
    
    // 初期テキストをセット
    obj.updateContent('text', this.speechText);
    obj.update();
  }

  createImage(label: string) {
    this.destroyAll();
    const obj = this.overlayPlugin.createTestOverlay('image', label);
    obj.width = 20;
    obj.height = 60;
    obj.left = 50;
    obj.top = 50;
    obj.update();
  }

  createCombinedSet() {
    this.destroyAll();
    
    // 1. 立ち絵 (image) を作成
    const stand = this.overlayPlugin.createTestOverlay('image', 'Stand');
    stand.anchor = 'bottom';
    stand.left = 40;
    stand.top = 100;
    stand.width = 20;
    stand.height = 60;
    stand.opacity = 1;
    stand.update();

    // 2. 吹き出し (speech) を作成
    const speech = this.overlayPlugin.createTestOverlay('speech', 'Speech');
    speech.anchor = 'bottom';
    speech.left = 40 + this.speechOffset.x;
    speech.top = 100 + this.speechOffset.y;
    speech.width = 30;
    speech.height = 10;
    speech.opacity = 1;
    speech.updateContent('text', '「ボトム基準での連動テストです」');
    speech.update();
  }

  selectImage() {
    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    // image タイプのオブジェクトを優先的に探す。なければ最新のもの。
    const target = objects.find(obj => obj.type === 'image') || this.targetObject;
    
    if (!target) return;
    this.modalService.open<string>(FileSelecterComponent, { isAllowedEmpty: false }).then(identifier => {
      if (identifier) {
        const imageFile = ImageStorage.instance.get(identifier);
        if (imageFile) {
          target.imageIdentifier = identifier;
          target.imageName = imageFile.name;
          target.update();
        }
      }
    });
  }

  setInitialState() {
    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    if (objects.length === 0) return;

    for (const obj of objects) {
      // 瞬間移動
      obj.transitionDuration = 0;
      obj.opacity = this.initial.opacity;
      obj.scale = this.initial.scale;
      obj.anchor = 'bottom';

      if (objects.length > 1) {
        // 連動モード: 画像を基準点、吹き出しを相対位置に配置
        if (obj.type === 'image') {
          obj.left = this.initial.x;
          obj.top = 100;
        } else if (obj.type === 'speech') {
          obj.left = this.initial.x + this.speechOffset.x;
          obj.top = 100 + this.speechOffset.y;
        }
      } else {
        // 単体モード: 指定された座標へ
        obj.left = this.initial.x;
        obj.top = 100;
      }
      obj.update();
    }
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
    this.targetObject.update(); // 同期と更新を通知
  }

  updateText() {
    if (!this.targetObject) return;
    this.targetObject.updateContent('text', this.speechText);
  }

  playCoupledAnimation() {
    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    
    for (const obj of objects) {
      obj.transitionDuration = this.anim.duration;
      obj.transitionEasing = this.anim.easing;
      obj.anchor = 'bottom';
      
      if (obj.type === 'image') {
        // 画像はターゲット座標へ
        obj.left = this.target.x;
        obj.top = 100;
      } else if (obj.type === 'speech') {
        // 吹き出しはターゲット座標から相対的に配置
        obj.left = this.target.x + this.speechOffset.x;
        obj.top = 100 + this.speechOffset.y;
      }
      obj.update();
    }
  }

  destroyAll() {
    this.overlayPlugin.clearAll();
  }
}