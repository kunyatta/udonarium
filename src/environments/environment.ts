import { CombatFlowModule } from '../app/plugins/combat-flow/combat-flow.module';
import { CharacterImageViewerModule } from '../app/plugins/character-image-viewer/character-image-viewer.module';
import { HelloWorldModule } from '../app/plugins/hello-world/hello-world.module';
import { AutoLayoutTestModule } from '../app/plugins/auto-layout-test/auto-layout-test.module';
import { TurnEngineTestModule } from '../app/plugins/turn-engine-test/turn-engine-test.module';
import { SimpleAlarmModule } from '../app/plugins/simple-alarm/simple-alarm.module';
import { RollCallModule } from '../app/plugins/roll-call/roll-call.module';
import { ChatLogManagerModule } from '../app/plugins/chat-log-manager/chat-log-manager.module';
// import { CombatFlowModule } from '../app/plugins/combat-flow/combat-flow.module';

export const environment = {
  production: false,
  pluginModules: [
    CombatFlowModule,
    ChatLogManagerModule,
    RollCallModule,
    SimpleAlarmModule,
    CharacterImageViewerModule,
    HelloWorldModule,
    AutoLayoutTestModule,
    TurnEngineTestModule
  ]
};
