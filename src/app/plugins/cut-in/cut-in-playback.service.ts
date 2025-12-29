import { Injectable } from '@angular/core';
import { CutIn } from './cut-in.model';
import { PluginOverlayService } from '../service/plugin-overlay.service';
import { OverlayObject } from '../overlay-object';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { Jukebox } from '@udonarium/Jukebox';
import { OverlayEffectsService } from '../service/overlay-effects.service';

@Injectable({
  providedIn: 'root'
})
export class CutInPlaybackService {
  constructor(
    private overlayService: PluginOverlayService,
    private effectsService: OverlayEffectsService
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

    // 演出終了・削除のスケジュール
    if (cutIn.duration > 0) {
      const totalMs = cutIn.duration * 1000;
      const outDuration = cutIn.outDuration || 0;

      // 退場アニメーションの開始 (削除の outDuration 前に実行)
      if (outDuration > 0 && outDuration < totalMs) {
        setTimeout(() => {
          if (ObjectStore.instance.get(overlay.identifier)) {
            this.applyExitConfig(overlay, cutIn);
          }
        }, totalMs - outDuration);
      }

      // 最終的な削除
      setTimeout(() => {
        if (ObjectStore.instance.get(overlay.identifier)) {
          overlay.destroy();
        }
      }, totalMs);
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

    // 演出終了・削除のスケジュール (ローカル)
    if (cutIn.duration > 0) {
      const totalMs = cutIn.duration * 1000;
      const outDuration = cutIn.outDuration || 0;

      // 退場アニメーション
      if (outDuration > 0 && outDuration < totalMs) {
        setTimeout(() => {
          this.applyExitConfig(overlay, cutIn, true);
        }, totalMs - outDuration);
      }

      // 最終的な削除
      setTimeout(() => {
        this.overlayService.destroyLocalOverlay(overlay.identifier);
      }, totalMs);
    }
  }

  private applyConfig(overlay: OverlayObject, cutIn: CutIn, isLocal: boolean = false) {
    // 1. 静的な基本設定
    overlay.width = cutIn.width;
    overlay.height = cutIn.height;
    overlay.isLocal = isLocal;
    
    // 有効期限 (削除のバッファとして +1秒)
    if (cutIn.duration > 0) {
      overlay.expirationTime = Date.now() + (cutIn.duration * 1000) + 1000;
    } else {
      overlay.expirationTime = 0;
    }
    
    if (cutIn.type === 'video' && cutIn.videoIdentifier) {
      overlay.videoIdentifier = cutIn.videoIdentifier;
      overlay.sourceType = 'youtube-video';
    } else {
      overlay.imageIdentifier = cutIn.imageIdentifier;
      overlay.sourceType = 'udonarium-image';
    }

    // 2. 状態遷移（登場アニメーション）の実行
    const startState = {
      left: cutIn.startLeft,
      top: cutIn.startTop,
      opacity: cutIn.startOpacity,
      scale: cutIn.startScale
    };

    const targetState = {
      left: cutIn.left,
      top: cutIn.top,
      opacity: cutIn.opacity,
      scale: cutIn.scale
    };

    this.effectsService.applyTransition(
      overlay, 
      startState, 
      targetState, 
      cutIn.inDuration, 
      cutIn.easing
    );
  }

  /**
   * 退場アニメーションのプロパティを適用します
   */
  private applyExitConfig(overlay: OverlayObject, cutIn: CutIn, isLocal: boolean = false) {
    overlay.transitionDuration = cutIn.outDuration;
    overlay.transitionEasing = cutIn.outEasing;
    overlay.left = cutIn.endLeft;
    overlay.top = cutIn.endTop;
    overlay.opacity = cutIn.endOpacity;
    overlay.scale = cutIn.endScale;
    
        if (!isLocal) {
    
          overlay.update();
    
        }
    
      }
    
    
    
      /**
    
       * 現在実行中の全ての演出（全員分および自分のみ）を停止・破棄します。
    
       */
    
      stopAll() {
    
        console.log('[CutIn] Stop All Overlays');
    
        // 同期されている全ての演出オブジェクトを削除（全員の画面から消える）
    
        const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    
        for (const obj of objects) {
    
          obj.destroy();
    
        }
    
        // 自分だけの演出（ローカル）も即座にクリア
    
        this.overlayService.clear();
    
      }
    
    }
    
    