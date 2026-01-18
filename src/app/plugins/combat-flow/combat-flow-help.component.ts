import { Component } from '@angular/core';

@Component({
  selector: 'app-combat-flow-help',
  template: `
    <div class="help-content">
      <ul class="help-list">
        <li><span class="key">クリック</span>: 対象を現在の<strong>手番</strong>に変更します。</li>
        <li><span class="key">Ctrl + クリック</span>: ターゲットを<strong>選択/解除</strong>します。</li>
        <li><span class="key">ダブルクリック</span>: <strong>行動済み</strong>状態を切り替えます。</li>
        <li><span class="key">右クリック</span>: <strong>戦闘メニュー</strong>（コントローラ、キャラシート等）を開きます。</li>
      </ul>
      <div class="note">※ ターゲット選択状態は盤面（3Dテーブル）上のコマの選択と同期しています。</div>
    </div>
  `,
  styles: [`
    .help-content {
      padding: 12px;
      font-size: 13px;
      color: #333;
      line-height: 1.5;
    }
    .help-list {
      list-style: none;
      padding: 0;
      margin: 0 0 12px 0;
    }
    .help-list li {
      margin-bottom: 8px;
    }
    .key {
      display: inline-block;
      min-width: 100px;
      font-weight: bold;
      color: #d32f2f;
      background: #f5f5f5;
      padding: 1px 6px;
      border: 1px solid #ccc;
      border-radius: 3px;
      margin-right: 8px;
      text-align: center;
    }
    .note {
      font-size: 11px;
      color: #666;
      border-top: 1px dashed #ccc;
      padding-top: 8px;
    }
  `]
})
export class CombatFlowHelpComponent {}
