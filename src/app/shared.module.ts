/**
 * SharedModule
 * 
 * AppModule と PluginsModule の両方から共通して利用される
 * コンポーネント、ディレクティブ、パイプを宣言・エクスポートするための共有モジュールです。
 * 
 * プラグイン側から本体の共通機能（SafePipe等）を参照する際の循環参照や
 * 依存関係の不整合を避けるために導入されました。
 */

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
