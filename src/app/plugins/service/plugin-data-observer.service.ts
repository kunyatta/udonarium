import { Injectable, NgZone } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { GameObject } from '@udonarium/core/synchronize-object/game-object';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { PluginHelperService } from './plugin-helper.service';

interface ObserverRegistration {
  pluginId: string;
  fileNameHint: string;
  callback: (container: PluginDataContainer) => void;
  container?: PluginDataContainer;
}

/**
 * Udonariumのプラグインデータコンテナの更新を監視するためのユーティリティサービス。
 * 通常時は即時通知（低遅延）を行い、大量更新時のみバッチ処理を行うことで、
 * P2P同期の正確性とパフォーマンスを両立させます。
 */
@Injectable({
  providedIn: 'root'
})
export class PluginDataObserverService {
  private registrations: Set<ObserverRegistration> = new Set();
  private isListening = false;
  private pendingNotifications: Set<ObserverRegistration> = new Set();
  private isBatching = false;
  private isLargeLoading = false;

  constructor(
    private pluginHelper: PluginHelperService,
    private ngZone: NgZone,
  ) { }

  private startListening() {
    if (this.isListening) return;
    this.isListening = true;

    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => this.handleEvent(event))
      .on('ADD_GAME_OBJECT', event => this.handleEvent(event))
      .on('DELETE_GAME_OBJECT', event => this.handleDeleteEvent(event))
      .on('XML_LOADED', () => this.handleXmlLoaded());
  }

  private handleEvent(event: any) {
    const identifier = event.data.identifier;
    const object = ObjectStore.instance.get(identifier);
    
    for (const reg of this.registrations) {
      let shouldNotify = false;

      // 1. コンテナ自体の検出/更新
      if (object && object.aliasName === 'plugin-data-container') {
        const containerCandidate = object as PluginDataContainer;
        if (containerCandidate.pluginId === reg.pluginId && containerCandidate.fileNameHint === reg.fileNameHint) {
          if (reg.container !== containerCandidate) {
            reg.container = containerCandidate;
            shouldNotify = true;
          }
        }
      }

      // 2. 関連性チェック
      if (reg.container) {
        if (identifier === reg.container.identifier || this.pluginHelper.isRelated(reg.container, identifier)) {
          shouldNotify = true;
        }
      } else {
        // Late Join対応: コンテナが見つかっていない場合のみ再スキャン
        const found = this.pluginHelper.findContainer(reg.pluginId, reg.fileNameHint);
        if (found) {
          reg.container = found;
          shouldNotify = true;
        }
      }

      if (shouldNotify) {
        this.notify(reg);
      }
    }
  }

  private handleDeleteEvent(event: any) {
    const identifier = event.data.identifier;
    for (const reg of this.registrations) {
      if (reg.container && reg.container.identifier === identifier) {
        reg.container = undefined;
        this.notify(reg);
      }
    }
  }

  private handleXmlLoaded() {
    this.isLargeLoading = true;
    for (const reg of this.registrations) {
      reg.container = this.pluginHelper.findContainer(reg.pluginId, reg.fileNameHint);
      this.notify(reg);
    }
    
    // 大量読み込み後のバッチ処理が終わったらフラグを下ろすために、XML_LOAD_COMPLETEDを待機する
    const listener = {};
    EventSystem.register(listener).on('XML_LOAD_COMPLETED', event => {
      this.isLargeLoading = false;
      EventSystem.unregister(listener);
    });
  }

  /**
   * 通知を実行する。状況に応じて即時通知かバッチ通知を切り替える。
   */
  private notify(reg: ObserverRegistration) {
    if (this.isLargeLoading) {
      // 大量読み込み中（入室直後、XML読込時）はバッチ処理で負荷を抑える
      this.queueBatchNotification(reg);
    } else {
      // 通常時は即時通知して同期の正確性を保つ
      this.ngZone.run(() => reg.callback(reg.container || null));
    }
  }

  private queueBatchNotification(reg: ObserverRegistration) {
    this.pendingNotifications.add(reg);
    if (this.isBatching) return;

    this.isBatching = true;
    Promise.resolve().then(() => {
      this.ngZone.run(() => {
        const toNotify = Array.from(this.pendingNotifications);
        this.pendingNotifications.clear();
        this.isBatching = false;
        for (const r of toNotify) {
          if (this.registrations.has(r)) {
            r.callback(r.container || null);
          }
        }
      });
    });
  }

  observe(
    context: any,
    pluginId: string,
    fileNameHint: string,
    callback: (container: PluginDataContainer) => void
  ): { unsubscribe: () => void } {
    this.startListening();

    const registration: ObserverRegistration = {
      pluginId,
      fileNameHint,
      callback,
      container: this.pluginHelper.findContainer(pluginId, fileNameHint)
    };

    this.registrations.add(registration);
    this.notify(registration);

    return {
      unsubscribe: () => {
        this.registrations.delete(registration);
        this.pendingNotifications.delete(registration);
      }
    };
  }
}
