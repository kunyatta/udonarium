import { InjectionToken, Injector } from '@angular/core';

/**
 * ユーザーインターフェースを持たないプラグインの基本インターフェースを表します。
 */
export interface IPlugin {
  readonly pluginName: string;
  /**
   * アプリケーション起動時に呼び出されます (APP_INITIALIZERを使用)。
   * UI関連以外の初期化処理に適しています。
   */
  initialize?(): void;
}

/**
 * ユーザーインターフェースを持つプラグインのインターフェースを表します。
 */
export interface IPluginWithUI extends IPlugin {
  // ランチャーに表示されるUIの名前。
  name: string;
  // 表示されるアイコン (Material Icons)。
  icon?: string;
  // 表示されるアイコンのCSSクラス。 (任意)
  iconClass?: string; // ----- MODIFICATION (kunyatta) -----
  // UIのタイプ: 'panel' または 'toggle'。
  type: 'panel' | 'toggle';
  // 表示するUIコンポーネント ('panel' タイプで必須)。
  component?: any;
  // トグル用のコールバック関数 ('toggle' タイプで必須)。
  toggleCallback?: (isActive: boolean) => void;
  // トグルの現在の状態。
  isActive?: boolean;
  // パネルの初期幅 (任意)。
  width?: number;
  // パネルの初期高さ (任意)。
  height?: number;
  // パネルの初期上位置 (任意)。
  top?: number;
  // パネルの初期左位置 (任意)。
  left?: number;
  // 自動レイアウトの設定 (任意)。'full-auto' または 'hybrid'。
  layout?: 'full-auto' | 'hybrid';
  // シングルトンとして扱うかどうかの設定 (任意)。trueの場合、同種のパネルは1つしか開かない。
  isSingleton?: boolean;

  // バージョン情報 (任意)。
  version?: string;
  // プラグインの概要 (任意)。
  description?: string;
  // 実験的/テスト用プラグインかどうかのフラグ (任意)。trueの場合、ランチャーから起動可能になる。
  isExperimental?: boolean;

  /**
   * メインアプリケーションのビューが初期化された後に呼び出されます。
   * モーダルを開くなど、UI関連の初期化に適しています。
   * @param injector 他のサービスを取得するためのインジェクタ。
   */
  initializeUI(injector: Injector): void;
}

/**
 * プラグインを提供するためのインジェクショントークン。
 * IPluginとIPluginWithUIの両方をこのトークンで提供する必要があります。
 */
export const PLUGIN_TOKEN = new InjectionToken<IPlugin>('PLUGINS');
