import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PLUGIN_TOKEN } from '../i-plugin';
import { SettingsPlugin } from './settings.plugin';

@NgModule({
  imports: [
    CommonModule
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: SettingsPlugin, multi: true }
  ]
})
export class SettingsModule { }
