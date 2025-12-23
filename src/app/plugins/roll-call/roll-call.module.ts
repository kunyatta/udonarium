import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PLUGIN_TOKEN } from '../i-plugin';
import { RollCallPlugin } from './roll-call.plugin';
import { RollCallControlComponent } from './roll-call-control.component'; // 追加
import { RollCallAnswerComponent } from './roll-call-answer.component'; // 追加
import { SharedModule } from '../../shared.module'; // SafePipeのために必要

@NgModule({
  declarations: [
    RollCallControlComponent, // 変更
    RollCallAnswerComponent // 追加
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: RollCallPlugin, multi: true }
  ],
})
export class RollCallModule { }
