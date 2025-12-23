// ----- SHARED_MODULE START (kunyatta) for Plugins System -----
//
// # 概要
// この SharedModule は、AppModule と PluginsModule の両方から共通して利用される
// コンポーネント、ディレクティブ、パイプを宣言・エクスポートするために作成されました。
//
// # 作成経緯
// PluginsModule に所属するコンポーネント (例: CharacterImageViewerComponent) から
// AppModule に所属する共通パイプ (例: SafePipe) を利用できず、ビルドエラー (NG6002) が
// 発生したため、CODING_STANDARDS.md の「2.3. 共通機能とモジュール分割（将来構想）」に
// 基づき、この SharedModule を実装しました。
//
// # 責任範囲
// このファイルはプラグインシステムの正常な動作のために後から追加されたものであり、
// その保守・管理責任はプラグイン開発の管轄（担当: kunyatta）にあります。
//
// ----- SHARED_MODULE END (kunyatta) for Plugins System -----

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafePipe } from './pipe/safe.pipe';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
  ],
  declarations: [
    SafePipe,
  ],
  exports: [
    // 共通で使うモジュール
    CommonModule,
    FormsModule,
    // 共通で使うパイプ
    SafePipe,
  ]
})
export class SharedModule { }
