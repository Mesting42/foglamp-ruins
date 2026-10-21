# 素材来源与许可

所有美术素材均由本项目绘制或以程序化几何模型生成；没有运行时 CDN、在线字体、外部图片包或第三方音频。Three.js 只作为 npm 渲染依赖，用于塑造并渲染本项目原创的角色、敌人、机关和建筑网格，不包含预制模型或纹理。

| 文件 / 素材 | 来源地址 | 作者 | 许可 / 商用 | 署名 | 修改方式 |
| --- | --- | --- | --- | --- | --- |
| public/assets/brand/lantern-mark.svg、public/favicon.svg | 本地文件；原创魔法雾灯徽记，SVG 矢量设计 | 雾灯遗迹项目 | 按 CC0 1.0 提供，可商用、修改和再分发 | 不强制；欢迎署名“雾灯遗迹项目” | 编辑 SVG 图层、路径、渐变和颜色 |
| public/assets/brand/app-icon-180.png、app-icon-192.png、app-icon-512.png | 本地文件；由 scripts/generate-brand-icons.ps1 按原创雾灯徽记几何图形生成，供 Apple Touch Icon 与 Web App Manifest 使用 | 雾灯遗迹项目 | 按 CC0 1.0 提供，可商用、修改和再分发 | 不强制 | 同步更新 lantern-mark.svg 与图标生成脚本中的构图和配色后重生成 |
| Phaser 降级角色与敌人精灵 | src/game/entities/textureFactory.ts 程序生成；仅在 Three.js WebGL 渲染不可用时使用 | 雾灯遗迹项目 | 按 CC0 1.0 提供，可商用、修改和再分发 | 不强制 | 修改 textureFactory.ts 中的 Phaser Graphics 绘制 |
| 低多边形探险者模型 | src/game/systems/CharacterModel3D.ts 程序生成；Three.js：[threejs.org](https://threejs.org/) | 模型：雾灯遗迹项目；渲染库：Three.js 作者 | 模型按 CC0 1.0 提供，可商用、修改和再分发；Three.js 为 MIT 许可，可用于商业项目，随项目再分发时保留其 MIT 声明 | 原创模型不强制署名；Three.js 再分发遵循 MIT 声明 | 直接修改 CharacterModel3D.ts 中的网格、材质、灯光和动画；Three.js 以 npm 依赖提供，没有复制或修改库源码 |
| 雾蛾、游魂、苔甲守卫、三阶段守塔者与旅人 NPC 的 3D 模型纹理 | src/game/systems/ThreeModelTextureFactory.ts 以 Three.js 程序网格渲染并在预载时烘焙 | 模型：雾灯遗迹项目；渲染库：Three.js 作者 | 原创模型按 CC0 1.0 提供，可商用、修改和再分发；Three.js 为 MIT 许可，可用于商业项目，随项目再分发时保留其 MIT 声明 | 原创模型不强制署名；Three.js 再分发遵循 MIT 声明 | 修改 ThreeModelTextureFactory.ts 对应 build 方法中的几何体、材质、灯光与颜色；无需修改或复制 Three.js 源码 |
| 开关祭台、符文石、潮阀、宝箱、浮台、石门、出口拱门、碎片与追逐落石的 3D 模型纹理 | src/game/systems/ThreeModelTextureFactory.ts 以 Three.js 程序网格渲染并在预载时烘焙 | 模型：雾灯遗迹项目；渲染库：Three.js 作者 | 原创模型按 CC0 1.0 提供，可商用、修改和再分发；Three.js 为 MIT 许可，可用于商业项目，随项目再分发时保留其 MIT 声明 | 原创模型不强制署名；Three.js 再分发遵循 MIT 声明 | 修改 ThreeModelTextureFactory.ts 的 buildInteractable、buildGate、buildExit、buildPlatform、buildGem 与 buildChaserRock 方法 |
| 地面、迷雾、树木、矿道装饰、水面、首领预警与光圈 | src/game/scenes/LevelScene.ts、src/game/entities/Boss.ts 程序生成 | 雾灯遗迹项目 | 按 CC0 1.0 提供，可商用、修改和再分发 | 不强制 | 编辑对应 TypeScript 绘制参数、颜色和布局 |
| 交互提示音 | src/game/systems/AudioManager.ts 由 Web Audio API 合成 | 雾灯遗迹项目 | 无外部录音；可随项目商用和再分发 | 不需要 | 修改振荡器类型、频率、时长和增益 |
| 庭院断墙、门洞侧墙、回声石碑、检查点灯台、渡河水道与灯焰变色 | src/game/systems/WorldLayout.ts、ThreeWorldView.ts、CharacterModel3D.ts 原创程序网格；无外部下载文件 | 雾灯遗迹项目 | 原创几何图案按 CC0 1.0 提供，可商用、修改和再分发 | 不强制 | 修改共享布局、网格尺寸和材质参数；渲染与碰撞共用布局 |
| 引光连线、命中光圈、收集光效及落石预警 | src/game/systems/WorldFeedback.ts、src/game/entities/Boss.ts、src/game/scenes/LevelScene.ts 原创程序图形 | 雾灯遗迹项目 | 图形按 CC0 1.0 提供，可商用、修改和再分发 | 不强制 | 修改对象池中的颜色、半径与时长；减少动态效果时保留短暂静态反馈 |
| 五段遗迹记忆、灯焰标记与手记界面 | src/game/data/adventure.ts、src/game/ui/GameUI.ts、src/styles/main.css 本地原创文案、HTML/CSS 图形 | 雾灯遗迹项目 | 原创文案和标记可随项目商用、修改和再分发 | 不强制 | 修改记忆文本、奖励颜色和响应式排版；未打包外部字体 |
| 中文 UI 字体 | 本机系统字体回退；没有随项目分发字体文件 | 操作系统字体提供方 | 遵循用户本机系统字体许可；本项目不复制字体文件 | 由字体提供方规定 | 修改 src/styles/main.css 的字体回退顺序 |

CC0 1.0 文本：[creativecommons.org/publicdomain/zero/1.0](https://creativecommons.org/publicdomain/zero/1.0/)

项目内原创素材以 CC0 1.0 提供，允许商业使用和再分发，无署名要求。Three.js 官方仓库和许可：[github.com/mrdoob/three.js](https://github.com/mrdoob/three.js)，MIT。若替换为第三方素材，请在此表增加文件名、原始下载页、作者、许可证、商业使用许可、署名要求与修改记录，并把实际文件放在 public/assets/、public/audio/ 或 public/fonts/。
