import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // 追加
import { TurnEngineTestComponent } from './turn-engine-test.component';
import { PLUGIN_TOKEN } from '../i-plugin';
import { TurnEngineTestPlugin } from './turn-engine-test.plugin';

@NgModule({
  declarations: [TurnEngineTestComponent],
  imports: [
    CommonModule,
    FormsModule // 追加
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: TurnEngineTestPlugin, multi: true }
  ],
  exports: [TurnEngineTestComponent]
})
export class TurnEngineTestModule { }
