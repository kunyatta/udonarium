import { Component } from '@angular/core';

@Component({
  selector: 'app-combat-flow-controller-help',
  template: `
    <div class="help-content">
      <div class="section">
        <h5>1. 術者 (Caster)</h5>
        <p>操作を行うキャラクターを選択します。パネルを開いた際や戦闘開始時に自動設定されます。</p>
      </div>
      
      <div class="section">
        <h5>2. 対象選択 (Target)</h5>
        <ul>
          <li>リストからクリックして選択（複数可）。</li>
          <li><span class="icon">🎲</span>ボタン：チャットログから最後に名前が出たキャラクターを自動選択します。</li>
        </ul>
      </div>

      <div class="section">
        <h5>3. パラメータ操作</h5>
        <ul>
          <li><strong>変化量:</strong> ダメージは負の数（-10など）、回復は正の数で入力します。</li>
          <li><span class="icon">±</span>ボタン：数値の正負を反転させます。</li>
          <li><span class="icon">🎲</span>ボタン：自分の直近のダイス結果をコピーします。</li>
        </ul>
      </div>

      <div class="section">
        <h5>4. 効果 (Status Effect)</h5>
        <p>「効果」タブに切り替えてテンプレートを選択し、実行ボタンで付与します。</p>
      </div>

      <div class="section execute">
        <h5>5. 実行</h5>
        <p>「実行」ボタンを押すと最終確認パネルが開きます。修正値などを確認して適用してください。</p>
      </div>
    </div>
  `,
  styles: [`
    .help-content { padding: 12px; font-size: 13px; color: #333; line-height: 1.4; }
    .section { margin-bottom: 12px; }
    h5 { margin: 0 0 4px 0; color: #1976d2; border-bottom: 1px solid #e0e0e0; font-size: 14px; }
    p, ul { margin: 4px 0; padding-left: 0; }
    ul { list-style: none; }
    li { margin-bottom: 4px; position: relative; padding-left: 14px; }
    li::before { content: "・"; position: absolute; left: 0; }
    .icon { display: inline-block; background: #555; color: #fff; padding: 0 4px; border-radius: 3px; font-size: 11px; margin: 0 2px; }
    .execute { background: #fff9c4; padding: 6px; border-radius: 4px; }
  `]
})
export class CombatFlowControllerHelpComponent {}
