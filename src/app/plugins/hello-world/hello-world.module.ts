import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HelloWorldPlugin } from './hello-world.plugin';
import { PLUGIN_TOKEN } from '../i-plugin';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [],
  providers: [
    HelloWorldPlugin,
    { provide: PLUGIN_TOKEN, useExisting: HelloWorldPlugin, multi: true }
  ]
})
export class HelloWorldModule { }
