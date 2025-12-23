import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PLUGIN_TOKEN } from '../i-plugin';
import { SimpleAlarmPlugin } from './simple-alarm.plugin';
import { SimpleAlarmPanelComponent } from './simple-alarm-panel.component';
import { AlarmNotificationComponent } from './alarm-notification.component'; // 追加

@NgModule({
  declarations: [
    SimpleAlarmPanelComponent,
    AlarmNotificationComponent // 追加
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: SimpleAlarmPlugin, multi: true }
  ],
})
export class SimpleAlarmModule { }
