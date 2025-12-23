import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoLayoutTestComponent } from './auto-layout-test.component';
import { AutoLayoutTestPlugin } from './auto-layout-test.plugin';
import { PLUGIN_TOKEN } from '../i-plugin';
import { PluginsComponentsModule } from '../components/plugins-components.module';
import { SharedModule } from '../../shared.module';
import { ReactiveImageService } from '../service/reactive-image.service';

@NgModule({
  declarations: [
    AutoLayoutTestComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    PluginsComponentsModule
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: AutoLayoutTestPlugin, multi: true },
    ReactiveImageService,
  ],
})
export class AutoLayoutTestModule { }
