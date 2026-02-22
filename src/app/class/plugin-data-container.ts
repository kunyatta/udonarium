import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { ObjectNode } from './core/synchronize-object/object-node';
import { DataElement } from './data-element';

@SyncObject('plugin-data') // セーブデータ内でのタグ名
export class PluginDataContainer extends ObjectNode {

  // どのプラグインのデータかを識別するためのID
  @SyncVar() pluginId: string = '';

  // プラグイン内で、どのデータかを識別するためのキー
  @SyncVar() key: string = '';

  // 保存先のファイル名を決定するためのヒント
  @SyncVar() fileNameHint: string = '';

  // 古いPluginDataContainerのデータ属性を読み込むためのフィールド (下位互換性のため)
  @SyncVar() data: string = ''; // ----- MODIFICATION (kunyatta) for Legacy Data Migration Support -----

  // データの本体は、このGameObjectの子要素としてDataElementツリーで表現される
  // 'state' という名前のDataElementを取得、なければ作成する
  get state(): DataElement {
    // 自分の子要素 (children) から 'state' という名前の DataElement を探す
    let element = this.children.find(child => child instanceof DataElement && child.name === 'state') as DataElement;
    if (element) return element;

    // なければ作成し、自身の子要素として追加する
    // P2P同期等のために、親のIDに基づいた決定論的なIDを使用する
    element = DataElement.create('state', '', {}, `${this.identifier}-state`);
    this.appendChild(element);
    return element;
  }
}
