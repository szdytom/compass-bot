## 源代码树结构

- `auth/`：服务器登录相关代码，与 authlib-injector 定义的 Yggdrasil 认证服务器交互。
- `docs/`：文档
- `enhanced-vec3/`：对 node-vec3 模块的方法拓展模块
- `patches/`：保存对依赖的补丁文件
- `plugin/`：各个 Mineflayer 机器人的插件模块
  - `control/`：地面移动模块
  - `event-promise/`：补齐部分 Mineflayer 接口的 `async/await` 异步支持的模块
  - `fly-control/`：鞘翅飞控模块
- `repl/`：机器人 REPL 控制相关代码
- `scripts/`：程序其他入口点
  - `tcp-repl-client.mjs`：用于连接适用于 TCP 的网络 REPL 的客户端
- `utils/`：实用代码与数据结构，各个模块的共享代码
- `index.mjs`：程序的核心入口点
