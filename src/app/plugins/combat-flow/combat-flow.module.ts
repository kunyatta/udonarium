import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared.module';
import { PLUGIN_TOKEN } from '../i-plugin';
import { CombatFlowPlugin } from './combat-flow.plugin';
import { CombatFlowPanelComponent } from './combat-flow-panel.component';
import { CombatFlowControllerComponent } from './combat-flow-controller.component';
import { CombatStateService } from './combat-state.service';
import { StatusEffectEditorComponent } from './status-effect-editor.component';
import { StatusEffectDictionaryService } from './status-effect-dictionary.service';
import { DamageCheckPanelComponent } from './damage-check-panel.component'; // Import DamageCheckPanelComponent

@NgModule({
  declarations: [
    CombatFlowPanelComponent,
    CombatFlowControllerComponent,
    StatusEffectEditorComponent,
    DamageCheckPanelComponent // Add DamageCheckPanelComponent to declarations
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: CombatFlowPlugin, multi: true },
    CombatStateService,
    StatusEffectDictionaryService
  ],
})
export class CombatFlowModule { }
