// import { CombatFlowModule } from '../app/plugins/combat-flow/combat-flow.module';
import { CharacterImageViewerModule } from '../app/plugins/character-image-viewer/character-image-viewer.module';
import { HelloWorldModule } from '../app/plugins/hello-world/hello-world.module';
// import { TestPluginModule } from '../app/plugins/test-plugin/test-plugin.module';
// import { AutoLayoutTestModule } from '../app/plugins/auto-layout-test/auto-layout-test.module';
// import { TurnEngineTestModule } from '../app/plugins/turn-engine-test/turn-engine-test.module';
// import { ChatLogManagerModule } from '../app/plugins/chat-log-manager/chat-log-manager.module';
// import { RollCallModule } from '../app/plugins/roll-call/roll-call.module';
// import { SimpleAlarmModule } from '../app/plugins/simple-alarm/simple-alarm.module';

export const environment = {
  production: false,
  pluginModules: [
    // CombatFlowModule,
    // ChatLogManagerModule,
    // RollCallModule,
    // SimpleAlarmModule,
    CharacterImageViewerModule,
    HelloWorldModule, // これだけ有効化
    // TestPluginModule,
    // AutoLayoutTestModule,
    // TurnEngineTestModule
  ]
};
