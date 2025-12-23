import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, Input } from '@angular/core';
import { GameCharacter } from '@udonarium/game-character';
import { Subject } from 'rxjs';
import { CombatStateService } from './combat-state.service';
import { CharacterDataService } from '../service/character-data.service';
import { CombatLogService } from './combat-log.service';
import { PluginUiService } from '../service/plugin-ui.service';
import { DamageApplyMode } from './combat-flow.constants'; // Import DamageApplyMode

interface DamageCheckCharacter {
  character: GameCharacter;
  currentHpMp: string; // 例: HP: 50 / 70
  referenceValues: { [key: string]: number }; // 参照パラメータごとの値
  finalValue: number; // 最終適用値 (カスタム入力用)
  selectedMode: DamageApplyMode; // Use imported DamageApplyMode type
  selectedSubMode?: string; // reduceの場合の参照パラメータ名
}

@Component({
  selector: 'app-damage-check-panel',
  templateUrl: './damage-check-panel.component.html',
  styleUrls: ['./damage-check-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DamageCheckPanelComponent implements OnInit, OnDestroy {

  @Input() casterId: string;
  @Input() targets: GameCharacter[];
  @Input() baseValue: number; // 入力された基準値（例: -20）
  @Input() targetParamName: string; // 対象パラメータ名（例: 'HP'）
  @Input() config: { referenceParams: string, buttonConfig: { showAsIs: boolean, showReduce: boolean, showHalve: boolean, showZero: boolean, showCustom: boolean } };

  private destroy$ = new Subject<void>();

  charactersToProcess: DamageCheckCharacter[] = [];
  availableReferenceParams: string[] = []; // 設定から読み込んだ参照パラメータのリスト

  public readonly DamageApplyMode = DamageApplyMode; // Expose Enum to template

  constructor(
    private combatStateService: CombatStateService,
    private characterDataService: CharacterDataService,
    private combatLogService: CombatLogService,
    private pluginUiService: PluginUiService,
    private changeDetectorRef: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {
    // 参照パラメータのリストを生成
    this.availableReferenceParams = this.config.referenceParams.split(/\s+/).filter(p => p);

    this.charactersToProcess = this.targets.map(char => {
      const refValues: { [key: string]: number } = {};
      this.availableReferenceParams.forEach(param => {
        refValues[param] = this.characterDataService.getParamValue(char, param);
      });

      return {
        character: char,
        currentHpMp: this.getHpMpDisplay(char, this.targetParamName),
        referenceValues: refValues,
        finalValue: 0, // 仮の値、後で計算
        selectedMode: DamageApplyMode.Reduce, // デフォルトは軽減モード
        selectedSubMode: this.availableReferenceParams[0] || '' // デフォルトは最初の参照パラメータ
      };
    });

    // 初期計算（デフォルト選択の軽減値で計算しておく）
    this.charactersToProcess.forEach(charData => {
      if (this.availableReferenceParams.length > 0) {
        charData.finalValue = this.getReducedValue(charData, this.baseValue, this.availableReferenceParams[0]);
        charData.selectedMode = DamageApplyMode.Reduce;
      } else {
        // 参照パラメータがない場合はそのまま
        charData.finalValue = this.calculateAsIsValue(this.baseValue);
        charData.selectedMode = DamageApplyMode.AsIs;
      }
    });
    this.changeDetectorRef.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // NaNチェック用のヘルパー (テンプレートから呼び出すため)
  isNaN(value: any): boolean {
    return Number.isNaN(value);
  }

  // HP/MPの現在値と最大値を表示
  getHpMpDisplay(character: GameCharacter, elementName: string): string {
    const element = this.characterDataService.getParamElement(character, elementName);
    if (!element || element.getAttribute('type') !== 'numberResource') {
      return '';
    }
    const current = this.characterDataService.getParamValue(character, `${elementName}.currentValue`);
    const max = this.characterDataService.getParamValue(character, `${elementName}.value`);
    return `${elementName}: ${current} / ${max}`;
  }

  // --- 計算ロジック ---

  calculateAsIsValue(baseValue: number): number {
    return baseValue;
  }

  // テンプレートから呼び出しやすいヘルパー
  getReducedValue(charData: DamageCheckCharacter, baseValue: number, param: string): number {
    if (baseValue > 0) return baseValue;
    const refValue = charData.referenceValues[param] || 0;
    const reduced = baseValue + refValue;
    return Math.min(0, reduced);
  }

  calculateHalvedValue(baseValue: number): number {
    if (baseValue > 0) return baseValue; // 回復の場合は半減しない（そのまま）
    return Math.ceil(baseValue / 2); // ダメージの場合、切り上げでダメージを少なくする
  }

  calculateZeroValue(): number {
    return 0;
  }

  // --- UI操作 ---

  onSelectMode(charData: DamageCheckCharacter, mode: DamageApplyMode, subMode?: string): void {
    charData.selectedMode = mode;
    charData.selectedSubMode = subMode;

    switch (mode) {
      case DamageApplyMode.AsIs:
        charData.finalValue = this.calculateAsIsValue(this.baseValue);
        break;
      case DamageApplyMode.Reduce:
        if (subMode) {
          charData.finalValue = this.getReducedValue(charData, this.baseValue, subMode);
        }
        break;
      case DamageApplyMode.Halve:
        charData.finalValue = this.calculateHalvedValue(this.baseValue);
        break;
      case DamageApplyMode.Zero:
        charData.finalValue = this.calculateZeroValue();
        break;
      // 'custom' の場合は finalValue は手入力なので変更しない
    }
    this.processCharacter(charData); // ワンクリック実行
  }

  onCustomValueChange(charData: DamageCheckCharacter, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    charData.finalValue = Number(inputElement.value);
  }

  onCustomApply(charData: DamageCheckCharacter): void {
    charData.selectedMode = DamageApplyMode.Custom; // モードをカスタムに設定
    this.processCharacter(charData); // ワンクリック実行
  }

  // --- メイン処理 ---

  processCharacter(charData: DamageCheckCharacter): void {
    const caster = this.characterDataService.resolveCharacter(this.casterId);
    
    // パラメータ適用
    // finalValue は適用したい差分値そのものなので、そのまま渡す
    this.characterDataService.applyParameterChange(
      charData.character,
      `${this.targetParamName}.currentValue`,
      charData.finalValue
    );

    // ログ出力
    let reason = '';
    switch (charData.selectedMode) {
      case DamageApplyMode.AsIs: reason = 'そのまま'; break;
      case DamageApplyMode.Reduce: 
        reason = `軽減(${charData.selectedSubMode})`; 
        break;
      case DamageApplyMode.Halve: reason = '半減'; break;
      case DamageApplyMode.Zero: reason = '無効'; break;
      case DamageApplyMode.Custom: reason = 'カスタム'; break;
    }
    this.combatLogService.logParameterChange(
      caster,
      [charData.character], // 単一のキャラクター
      this.targetParamName,
      charData.finalValue, // 適用した差分値を渡す
      reason
    );

    // 処理済みキャラクターをリストから削除
    this.charactersToProcess = this.charactersToProcess.filter(c => c.character.identifier !== charData.character.identifier);
    this.changeDetectorRef.markForCheck();

    // 全て処理し終わったらパネルを閉じる
    if (this.charactersToProcess.length === 0) {
      // シングルトンとして開いているので、コンストラクタ（クラス）を渡して閉じる
      this.pluginUiService.close(this.constructor as any); 
    }
  }

  cancelAll(): void {
    this.pluginUiService.close(this.constructor as any);
  }
}