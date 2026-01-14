import { Component } from '@angular/core';

@Component({
  selector: 'app-combat-flow-manager-help',
  template: `
    <div class="help-content">
      <h5>手番・戦闘管理</h5>
      <ul>
        <li><b>戻る/次へ:</b> 手番（キャラクター）を前後に移動させます。</li>
        <li><b>次ラウンド:</b> ラウンドを1進め、手番を先頭に戻します。</li>
        <li><b>ラウンド表示:</b> クリックするとラウンドを1にリセットします。</li>
      </ul>

      <h5>キャラクターリスト</h5>
      <ul>
        <li><b>チェックボックス:</b> チェックONで戦闘参加、OFFで待機（除外）になります。</li>
        <li><b>並べ替え:</b> キャラクター名を選択し、下の「▲/▼」ボタンで参加順（イニシアティブ順）を変更できます。</li>
      </ul>

      <h5>その他</h5>
      <ul>
        <li><b>⚔️ 操作ボタン:</b> 現在の手番キャラクターを対象とした「戦闘アクション」画面を開きます。</li>
      </ul>
    </div>
  `,
  styles: [`
    .help-content { font-size: 12px; padding: 10px; color: #333; line-height: 1.4; }
    ul { padding-left: 20px; margin-top: 5px; }
    li { margin-bottom: 8px; }
    b { color: #d32f2f; }
  `]
})
export class CombatFlowManagerHelpComponent {}
