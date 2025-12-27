import { Injectable } from '@angular/core';
import { CutIn } from './cut-in.model';
import { PluginOverlayService } from '../service/plugin-overlay.service';
import { OverlayObject } from '../overlay-object';
import { SoundEffect } from '@udonarium/sound-effect';
import { EventSystem } from '@udonarium/core/system';

@Injectable({
  providedIn: 'root'
})
export class CutInPlaybackService {
  constructor(
    private overlayService: PluginOverlayService
  ) {}

  /**
   * 全員に同期してカットインを再生する
   */
  play(cutIn: CutIn) {
    console.log('[CutIn] Play (Global):', cutIn.name);
    
    // OverlayObjectを生成
    const overlay = this.overlayService.createOverlay('standing');
    if (!overlay) return;

    this.applyConfig(overlay, cutIn);
    
    // 音声再生 (静的メソッドを使用)
    if (cutIn.audioIdentifier) {
      SoundEffect.play(cutIn.audioIdentifier);
    }

    // 指定時間後に削除
    setTimeout(() => {
      overlay.destroy();
    }, cutIn.duration * 1000);
  }

  /**
   * 自分にだけカットインを表示する (テスト用)
   */
  playLocal(cutIn: CutIn) {
    console.log('[CutIn] Play (Local):', cutIn.name);
    
    // ローカル専用のOverlayObjectを生成
    const overlay = this.overlayService.createLocalOverlay('standing');
    if (!overlay) return;

    this.applyConfig(overlay, cutIn, true); // ローカルフラグを立てる
    
    // 音声再生 (ローカル)
    if (cutIn.audioIdentifier) {
      SoundEffect.playLocal(cutIn.audioIdentifier);
    }

    // 指定時間後に削除
    setTimeout(() => {
      this.overlayService.destroyLocalOverlay(overlay.identifier);
    }, cutIn.duration * 1000);
  }

  private applyConfig(overlay: OverlayObject, cutIn: CutIn, isLocal: boolean = false) {
    overlay.left = cutIn.left;
    overlay.top = cutIn.top;
    overlay.width = cutIn.width;
    overlay.height = cutIn.height;
    overlay.opacity = cutIn.opacity;
    overlay.scale = cutIn.scale;
    overlay.imageIdentifier = cutIn.imageIdentifier;
    overlay.type = 'standing';
    
    if (!isLocal) {
      overlay.update();
    }
  }
}
