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
  
  get targetObject(): OverlayObject {
    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    return objects[objects.length - 1];
  }

  constructor(
    private overlayPlugin: OverlayTestPlugin,
    private modalService: ModalService
  ) {}

  createStanding(label: string) {
    this.overlayPlugin.createTestOverlay('standing', label);
  }

  destroyAll() {
    this.overlayPlugin.clearAll();
  }

  selectImage() {
    if (!this.targetObject) return;
    this.modalService.open<string>(FileSelecterComponent, { isAllowedEmpty: false }).then(identifier => {
      if (identifier) {
        // Udonarium の ImageStorage からファイル情報を取得
        const imageFile = ImageStorage.instance.get(identifier);
        if (imageFile) {
          // P2P 同期のキーとしてファイル名をセット
          this.targetObject.imageName = imageFile.name;
          // 互換性/バックアップとして ID も保持
          this.targetObject.updateContent('url', identifier);
          this.targetObject.update();
        }
      }
    });
  }

  addEffect(name: string) {
    this.targetObject?.addTask(name, 500); // 500ms
  }
}
