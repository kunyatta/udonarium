import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PLUGIN_TOKEN } from '../i-plugin';
import { TargetSelectorPlugin } from './target-selector.plugin';
import { TargetSelectorService } from './target-selector.service';

@NgModule({
  imports: [CommonModule],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: TargetSelectorPlugin, multi: true },
    TargetSelectorService
  ]
})
export class TargetSelectorModule { }
