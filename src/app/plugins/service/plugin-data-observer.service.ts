import { Injectable, NgZone } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { GameObject } from '@udonarium/core/synchronize-object/game-object';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { PluginHelperService } from './plugin-helper.service';

/**
 * Udonariumのプラグインデータコンテナの更新を監視するためのユーティリティサービス。
 * EventSystemの複雑な購読と、P2P同期やルームロードによるコンテナの再生成への追従ロジックをカプセル化する。
 */
@Injectable({
  providedIn: 'root'
})
export class PluginDataObserverService {

  constructor(
    private pluginHelper: PluginHelperService,
    private ngZone: NgZone,
  ) { }

  /**
   * 特定のプラグインデータコンテナの更新を監視し、コールバックを実行する。
   * @param context EventSystemに登録する際のコンテキスト (通常は呼び出し元の `this`)。
   * @param pluginId 監視対象のプラグインID。
   * @param fileNameHint 監視対象のファイル名ヒント。
   * @param callback コンテナまたはその子孫が更新された際に実行されるコールバック。引数には最新のコンテナが渡される。
   * @returns 購読を停止するための `unsubscribe` メソッドを持つオブジェクト。
   */
  observe(
    context: any,
    pluginId: string,
    fileNameHint: string,
    callback: (container: PluginDataContainer) => void
  ): { unsubscribe: () => void } {

    let container = this.pluginHelper.findContainer(pluginId, fileNameHint);

    const handler = (event: { data: { identifier: string } }) => {
      const identifier = event.data.identifier;
      const object = ObjectStore.instance.get(identifier);

      // イベントで飛んできたオブジェクトが、自分の探している新しいコンテナそのものである場合
      if (object instanceof PluginDataContainer && object.pluginId === pluginId && object.fileNameHint === fileNameHint) {
        // 参照を新しいコンテナに乗り換える
        if (!container || container.identifier !== identifier) {
          container = object;
        }
      }

      // コンテナが存在し、かつイベントがそのコンテナに関連する場合にコールバックを実行
      if (this.pluginHelper.isRelated(container, identifier)) {
        this.ngZone.run(() => callback(container));
      }
    };
    
    // イベントリスナーを登録
    EventSystem.register(context)
      .on('UPDATE_GAME_OBJECT', handler)
      .on('ADD_GAME_OBJECT', handler) // ADD_GAME_OBJECT を追加
      .on('DELETE_GAME_OBJECT', event => {
        if (container && container.identifier === event.data.identifier) {
          // コンテナが削除されたら参照をリセットし、コールバックにnullを渡す
          container = undefined;
          this.ngZone.run(() => callback(null));
        }
      });

    // 初期状態でコールバックを一度実行
    if (container) {
      this.ngZone.run(() => callback(container));
    } else {
      // コンテナが見つからない場合、nullでコールバックを呼び、初期状態を通知する
      this.ngZone.run(() => callback(null));
    }
    
    // 購読を停止するためのメソッドを返す
    return {
      unsubscribe: () => {
        EventSystem.unregister(context);
      }
    };
  }
}
