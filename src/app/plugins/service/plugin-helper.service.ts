import { Injectable } from '@angular/core';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';

@Injectable({
  providedIn: 'root'
})
export class PluginHelperService {

  constructor() { }

  /**
   * 指定された条件に一致するPluginDataContainerを検索し、存在しなければ新規作成してObjectStoreに登録して返す。
   * 主にUIコンポーネントで使用する。
   * @param pluginId プラグインID
   * @param fileNameHint ファイル名ヒント (デフォルト: 'default')
   */
  getOrCreateContainer(pluginId: string, fileNameHint: string = 'default'): PluginDataContainer {
    let container = this.findContainer(pluginId, fileNameHint);
    
    if (!container) {
      container = new PluginDataContainer();
      container.pluginId = pluginId;
      container.fileNameHint = fileNameHint;
      container.initialize();
      ObjectStore.instance.add(container);
    }
    return container;
  }

  /**
   * 指定された条件に一致するPluginDataContainerを検索して返す。
   * 見つからない場合はundefinedを返す。
   * 主にPluginエントリーポイントなどで、勝手に作成したくない場合に使用する。
   * @param pluginId プラグインID
   * @param fileNameHint ファイル名ヒント (デフォルト: 'default')
   */
  findContainer(pluginId: string, fileNameHint: string = 'default'): PluginDataContainer | undefined {
    return ObjectStore.instance.getObjects(PluginDataContainer)
      .find(c => c.pluginId === pluginId && c.fileNameHint === fileNameHint);
  }

  /**
   * 指定されたidentifierが、コンテナ自身、またはコンテナの子孫要素（DataElement等）であるかを判定する。
   * @param container 判定対象のコンテナ
   * @param identifier 判定したいオブジェクトのidentifier
   */
  isRelated(container: PluginDataContainer, identifier: string): boolean {
    if (!container || !identifier) return false;
    if (identifier === container.identifier) return true;

    const object = ObjectStore.instance.get(identifier);
    if (object instanceof ObjectNode) {
      // ObjectNode.contains は子から親へ遡る実装なので効率的
      return container.contains(object);
    }
    return false;
  }
}
