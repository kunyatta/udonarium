import { Component, OnInit } from '@angular/core';
import { DynamicStandPluginService } from './dynamic-stand.service';
import { StandGlobalConfig } from './dynamic-stand.model';

@Component({
  selector: 'dynamic-stand-setting',
  templateUrl: './dynamic-stand-setting.component.html',
  styleUrls: ['./dynamic-stand-setting.component.css']
})
export class DynamicStandSettingComponent implements OnInit {
  get config(): StandGlobalConfig {
    return this.service.config;
  }

  constructor(private service: DynamicStandPluginService) {}

  ngOnInit(): void {}

  resetDefault() {
    // デフォルト値に戻す処理（必要に応じて）
  }
}
