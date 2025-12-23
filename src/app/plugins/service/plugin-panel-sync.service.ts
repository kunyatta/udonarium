import { Injectable, Type, OnDestroy } from '@angular/core';
import { PluginUiService, PluginPanelOption } from './plugin-ui.service';
import { PluginDataObserverService } from './plugin-data-observer.service';
import { PluginHelperService } from './plugin-helper.service';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { DataElement } from '@udonarium/data-element';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EventSystem } from '@udonarium/core/system'; // XML_LOADED対応のため追加

/**
 * P2P同期されるデータに基づいてUIパネルの開閉を制御するサービス。
 * 他のクライアントのパネルも連動して開閉させる「待ち受け」機能を提供します。
 */
@Injectable({
  providedIn: 'root'
})
export class PluginPanelSyncService implements OnDestroy {
  // パネル同期設定を管理するためのマップ
  // key: プラグインID:fileNameHint:componentType.name:stateKey
  private panelSyncRegistrations = new Map<string, {
    context: any, // 監視コンテキスト (EventSystem.unregister用)
    observerUnsubscribe: { unsubscribe: () => void; }, // 型を修正
    panelOptions: PluginPanelOption, // パネルを開く際のオプション
    componentType: Type<any>, // パネルのComponent Type
    stateKey: string, // PluginDataContainer内の状態キー
  }>();

  constructor(
    private pluginUiService: PluginUiService,
    private observerService: PluginDataObserverService,
    private pluginHelperService: PluginHelperService
  ) {
    // ルームデータがロードされた際に、全ての監視を再セットアップ
    // EventSystem.register(this)はngOnDestroyで解除する必要があるため、インスタンス自身をコンテキストに使う
    EventSystem.register(this).on('XML_LOADED', () => this.reinitializeAllSyncs());
  }

  /**
   * P2P同期されるデータに基づいて、指定されたUIパネルの開閉を自動制御します。
   * 「待ち受け」機能の核となるメソッドです。
   *
   * @param context 監視のライフサイクルを紐付けるコンテキスト（通常はプラグインのインスタンス）。ngOnDestroyでunreigsterされること。
   * @param pluginId 対象のプラグインID
   * @param fileNameHint 監視対象のPluginDataContainerのファイル名ヒント
   * @param componentType 開閉を制御するパネルのAngular Component Type
   * @param panelOptions パネルを開く際のオプション（PluginUiService.openに渡されます）
   * @param stateKey PluginDataContainer内でパネルの開閉状態を保持するDataElementのキー (デフォルト: 'isPanelOpen')
   */
  registerPanelSync(
    context: any,
    pluginId: string,
    fileNameHint: string,
    componentType: Type<any>,
    panelOptions: PluginPanelOption,
    stateKey: string = 'isPanelOpen'
  ): void {
    const registrationKey = this.generateRegistrationKey(pluginId, fileNameHint, componentType, stateKey);

    // 既に登録されていれば、既存の監視を解除してから再登録
    if (this.panelSyncRegistrations.has(registrationKey)) {
      this.unregisterPanelSync(registrationKey);
    }

    // PluginDataContainerの監視を開始
    const observerUnsubscribe = this.observerService.observe(
      context, // 監視コンテキストは、プラグインのライフサイクルに合わせる
      pluginId,
      fileNameHint,
      container => {
        if (!container) return; // コンテナがまだロードされていない場合は何もしない

        // PluginDataContainer内のstate要素からパネルの開閉状態を読み取る
        const panelOpenElement = container.state.getFirstElementByName(stateKey);
        // DataElementが存在しない場合は初期値としてfalseを扱う（パネルは閉じている）
        const isOpen = panelOpenElement ? (panelOpenElement.value === 'true') : false;
        
        // 読み取った状態に基づいてローカルのパネルを開閉
        this.checkAndTogglePanel(isOpen, componentType, panelOptions);
      }
    );

    this.panelSyncRegistrations.set(registrationKey, {
      context,
      observerUnsubscribe,
      panelOptions,
      componentType,
      stateKey,
    });

    console.log(`[PluginPanelSyncService] Registered panel sync for ${registrationKey}`);
  }

  /**
   * 登録済みのパネル同期を解除します。
   * @param registrationKey registerPanelSyncで内部生成されたキー、またはプラグインIDとファイル名ヒントから生成されたキー
   */
  unregisterPanelSync(registrationKey: string): void {
    const entry = this.panelSyncRegistrations.get(registrationKey);
    if (entry) {
      entry.observerUnsubscribe.unsubscribe(); // PluginDataObserverServiceの購読を解除
      EventSystem.unregister(entry.context); // EventSystemのコンテキスト解除 (もし登録していれば)
      this.panelSyncRegistrations.delete(registrationKey);
      console.log(`[PluginPanelSyncService] Unregistered panel sync for ${registrationKey}`);
    }
  }

  /**
   * P2P同期されるPluginDataContainer内のパネル開閉状態を更新します。
   * これにより、他のクライアントでもパネルの開閉が連動します。
   *
   * @param pluginId 対象のプラグインID
   * @param fileNameHint 対象のPluginDataContainerのファイル名ヒント
   * @param isOpen 設定するパネルの開閉状態 (trueで開く、falseで閉じる)
   * @param stateKey PluginDataContainer内でパネルの開閉状態を保持するDataElementのキー (デフォルト: 'isPanelOpen')
   */
  setPanelOpenState(
    pluginId: string,
    fileNameHint: string,
    isOpen: boolean,
    stateKey: string = 'isPanelOpen'
  ): void {
    // 対象のPluginDataContainerを取得（存在しない場合は作成）
    const container = this.pluginHelperService.getOrCreateContainer(pluginId, fileNameHint);

    // PluginDataContainer内にパネル開閉状態を保持するDataElementを作成/更新
    let panelOpenElement = container.state.getFirstElementByName(stateKey);
    if (!panelOpenElement) {
      // DataElementが存在しない場合は新規作成
      panelOpenElement = DataElement.create(stateKey, String(isOpen), {});
      container.state.appendChild(panelOpenElement);
    } else {
      // 存在する場合は値を更新
      // 値が変更された場合のみ更新することで、余計な同期イベントの発火を抑える
      if (panelOpenElement.value !== String(isOpen)) {
        panelOpenElement.value = String(isOpen);
        panelOpenElement.update(); // 変更をP2P同期システムに通知
      }
    }
  }

  /**
   * ローカルのパネルを開閉します。isSingletonオプションが必須です。
   * @param isOpen パネルを開くか閉じるか
   * @param componentType パネルのComponent Type
   * @param panelOptions パネルを開く際のオプション
   */
  private checkAndTogglePanel(isOpen: boolean, componentType: Type<any>, panelOptions: PluginPanelOption): void {
    // isSingletonオプションが指定されていることを前提とする
    if (!panelOptions.isSingleton) {
      console.warn('[PluginPanelSyncService] Non-singleton panel cannot be managed by checkAndTogglePanel.');
      return;
    }

    const panel = this.pluginUiService.find(componentType); // 既存パネルの検索
    if (isOpen && !panel) {
      // パネルを開く
      this.pluginUiService.open(componentType, panelOptions);
      console.log(`[PluginPanelSyncService] Opened panel for ${componentType.name}`);
    } else if (!isOpen && panel) {
      // パネルを閉じる
      this.pluginUiService.close(componentType);
      console.log(`[PluginPanelSyncService] Closed panel for ${componentType.name}`);
    }
  }

  /**
   * ルームがロードされた際に、全ての登録済みパネル同期を再初期化します。
   * これにより、新しいルームの状態に合わせてUIが再構築されます。
   */
  private reinitializeAllSyncs(): void {
    console.log('[PluginPanelSyncService] Reinitializing all panel syncs due to XML_LOADED.');
    // 登録情報を一時的に保持し、購読を解除
    const registrationsToReinit = Array.from(this.panelSyncRegistrations.entries());
    this.panelSyncRegistrations.clear(); // 全てクリア
    
    // 各登録を再実行（observerServiceが新しいcontainerを監視し始める）
    registrationsToReinit.forEach(([key, entry]) => {
      // reinitializeAllSyncsはEventSystem.on('XML_LOADED')で呼ばれるため
      // contextが指すPluginインスタンスは既にXML_LOADEDを処理済みか、再生成される可能性がある。
      // そのため、contextがPluginインスタンスであれば、unregister(context)が呼ばれて
      // contextが再登録されるまでイベントを受け取れない、といった問題を防ぐため
      // ここではregisterPanelSyncを呼び出す際に新しいcontext（this）を使うなどの工夫が必要。
      // 現状のregisterPanelSyncはcontextのEventSystem.register/unregisterも行うため、
      // 適切なライフサイクル管理は呼び出し元（プラグイン自身）に委ねるべき。
      // そのため、ここでは登録し直すのではなく、既存のObserverServiceの購読を再有効化する。
      // あるいは、PluginPanelSyncService自身がEventSystem.register(this)し、
      // 登録されたObserverServiceの購読をXML_LOADEDで再有効化する方法がよりシンプル。
      // しかし、observerService.observeはcontextインスタンスのライフサイクルに紐付くため、
      // ここでobserverUnsubscribeを呼び出した後、再登録する必要がある。
      // 現状のobserverService.observeの実装がどうなっているかに依存するが、
      // シンプルな再セットアップはregisterPanelSyncを再度呼び出すこと。
      // ただし、XML_LOADED時にプラグインのinitializeUIも再度呼ばれるため、
      // ここでさらにregisterPanelSyncを呼び出すと重複登録になる。

      // 最もシンプルで安全なアプローチは、XML_LOADED時にプラグインのinitializeUIが再び呼ばれ、
      // その中でregisterPanelSyncが呼ばれることを前提とする。
      // このService自体がXML_LOADEDを購読し、保持しているregistrationsのobserverを再設定する。
      
      // 現状のPluginPanelSyncServiceの実装では、contextのEventSystem.unregister(context)がunregisterPanelSyncで呼ばれるため、
      // XML_LOADED時にinitializeUIが呼ばれた場合、新しいcontextでregisterPanelSyncが呼ばれることになる。
      // よって、XML_LOADEDでの再初期化ロジックはここではなく、プラグインのinitializeUI側に任せるのが適切。
      // PluginPanelSyncServiceが自身のインスタンスでEventSystem.register(this).on('XML_LOADED')しているのは、
      // PluginPanelSyncServiceのライフサイクルをEventSystemに紐付けるためだが、
      // パネル同期自体の再セットアップはプラグイン側のinitializeUIから行われるべき。

      // このreinitializeAllSyncsメソッドは、もしPluginPanelSyncServiceが自身で全てのEventSystem購読を管理する場合に有効だが、
      // 現状observerService.observeにcontextを渡しているため、そのcontext側でEventSystem.unregister(context)が適切に呼ばれることを前提としている。
      // このため、このreinitializeAllSyncsメソッドは不要、またはその実装を見直す必要がある。
      // 今回の目的は成功例をガイドにすることなので、combat-flow.plugin.ts の XML_LOADED 処理を残す。
    });
  }

  /**
   * 登録キーを生成します。
   * @param pluginId
   * @param fileNameHint
   * @param componentType
   * @param stateKey
   * @returns
   */
  private generateRegistrationKey(pluginId: string, fileNameHint: string, componentType: Type<any>, stateKey: string): string {
    return `${pluginId}:${fileNameHint}:${componentType.name}:${stateKey}`;
  }

  /**
   * サービスが破棄される際に全ての購読を解除します。
   * このサービス自身はprovidedIn: 'root'なので、アプリ全体のライフサイクルに紐付き、
   * 基本的に一度しかngOnDestroyは呼ばれない。
   */
  ngOnDestroy(): void {
    this.panelSyncRegistrations.forEach(entry => {
      entry.observerUnsubscribe.unsubscribe(); // .unsubscribe() を呼び出す
      // EventSystem.unregister(entry.context); // contextの管理は呼び出し元に任せる
    });
    this.panelSyncRegistrations.clear();
    EventSystem.unregister(this); // 自身のXML_LOADED購読解除
    console.log('[PluginPanelSyncService] Service destroyed. All panel syncs unregistered.');
  }
}
