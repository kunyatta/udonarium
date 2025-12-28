import { Injectable } from '@angular/core';
import { CutIn } from './cut-in.model';
import { PluginOverlayService } from '../service/plugin-overlay.service';
import { OverlayObject } from '../overlay-object';
import { SoundEffect } from '@udonarium/sound-effect';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { Jukebox } from '@udonarium/Jukebox';

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

    // BGM停止処理
    if (cutIn.stopJukebox) {
      const jukebox = ObjectStore.instance.get<Jukebox>('Jukebox');
      if (jukebox) jukebox.stop();
    }
    
    // タイプに応じたOverlayObjectを生成
    const type = cutIn.type || 'image';
    const overlay = this.overlayService.createOverlay(type);
    if (!overlay) return;

    this.applyConfig(overlay, cutIn);
    
    // 音声再生
    if (cutIn.audioIdentifier && cutIn.audioMode !== 'none') {
      if (cutIn.audioMode === 'bgm') {
        const jukebox = ObjectStore.instance.get<Jukebox>('Jukebox');
        if (jukebox) jukebox.play(cutIn.audioIdentifier, true);
      } else {
        // SE再生 (インスタンス制御のため常にOverlayObjectを介す)
        overlay.updateContent('audioIdentifier', cutIn.audioIdentifier);
        if (cutIn.isLoop) {
          overlay.updateContent('isLoop', 1);
        }
      }
    }

    // 指定時間後に削除 (0の場合は削除しない=無制限)
    if (cutIn.duration > 0) {
      setTimeout(() => {
        overlay.destroy();
      }, cutIn.duration * 1000);
    }
  }

  /**
   * 自分にだけカットインを表示する (テスト用)
   */
  playLocal(cutIn: CutIn) {
    console.log('[CutIn] Play (Local):', cutIn.name);

    // ローカルでのBGM停止
    if (cutIn.stopJukebox) {
      const jukebox = ObjectStore.instance.get<Jukebox>('Jukebox');
      if (jukebox) jukebox.stop();
    }
    
    // ローカル専用のOverlayObjectを生成
    const type = cutIn.type || 'image';
    const overlay = this.overlayService.createLocalOverlay(type);
    if (!overlay) return;

    this.applyConfig(overlay, cutIn, true); // ローカルフラグを立てる
    
    // 音声再生 (ローカル)
    if (cutIn.audioIdentifier && cutIn.audioMode !== 'none') {
      if (cutIn.audioMode === 'bgm') {
        const jukebox = ObjectStore.instance.get<Jukebox>('Jukebox');
        if (jukebox) jukebox.play(cutIn.audioIdentifier, true);
      } else {
        // SE再生 (インスタンス制御のため常にOverlayObjectを介す)
        overlay.updateContent('audioIdentifier', cutIn.audioIdentifier);
        if (cutIn.isLoop) {
          overlay.updateContent('isLoop', 1);
        }
      }
    }

    // 指定時間後に削除 (0の場合は削除しない=無制限)
    if (cutIn.duration > 0) {
      setTimeout(() => {
        this.overlayService.destroyLocalOverlay(overlay.identifier);
      }, cutIn.duration * 1000);
    }
  }

  private applyConfig(overlay: OverlayObject, cutIn: CutIn, isLocal: boolean = false) {
    overlay.left = cutIn.left;
    overlay.top = cutIn.top;
    overlay.width = cutIn.width;
    overlay.height = cutIn.height;
    overlay.opacity = cutIn.opacity;
    overlay.scale = cutIn.scale;
    overlay.isLocal = isLocal;
    
    // 有効期限の設定 (現在時刻 + 持続時間 + マージン1秒)
    // 0の場合は無制限とするため、expirationTimeは0のまま(無効)にする
    if (cutIn.duration > 0) {
      overlay.expirationTime = Date.now() + (cutIn.duration * 1000) + 1000;
    } else {
      overlay.expirationTime = 0;
    }
    
    // メディアソースの設定
    if (cutIn.type === 'video' && cutIn.videoIdentifier) {
      overlay.sourceIdentifier = cutIn.videoIdentifier;
      overlay.sourceType = 'youtube-video';
    } else {
      // 画像の場合 (デフォルト)
      overlay.sourceIdentifier = cutIn.imageIdentifier;
      overlay.imageIdentifier = cutIn.imageIdentifier; // 互換性のため維持
      overlay.sourceType = 'udonarium-image';
    }
    
    if (!isLocal) {
      overlay.update();
    }
  }
}
