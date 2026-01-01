import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogoutPlugin } from './logout.plugin';
import { PLUGIN_TOKEN } from '../i-plugin';

@NgModule({
  imports: [
    CommonModule
  ],
  providers: [
    LogoutPlugin,
    { provide: PLUGIN_TOKEN, useExisting: LogoutPlugin, multi: true }
  ]
})
export class LogoutModule { }