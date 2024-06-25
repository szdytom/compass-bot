# Compass Bot

## 安装

运行下面命令安装 Node.JS 的依赖包并应用补丁：

```sh
npm i
npx patch-package
```

## 配置认证数据

在项目根目录下创建 `credentials.json`，包含如下内容：

```json
{
	"endpoint": "Yggdrasil API 调用点",
	"endpoint_auth": "Yggdrasil API 用户服务器调用点（可选）",
	"endpoint_session": "Yggdrasil API 会话服务器调用点（可选）",
	"accounts": [{
		"handle": "登录名（在支持非邮箱登录的 Yggdrasil 服务器上可选）",
		"password": "密码",
		"profiles": ["角色名1", "角色名2"]
	}]
}
```

## 运行

运行下面命令启动：

```sh
node index.mjs profile@hostname[:port]
```

参数含义：

 + `profile`：表示连接到服务器使用的角色名
 + `hostname`：服务器地址
 + `port`：服务器端口（可选，默认值为 25565）

命令行选项：

 + `--offline`：使用离线模式启动
 + `--credentials-lib <file>`：指定登录凭据文件（可选，默认值：`credentials.json`）
 + `--no-local-repl`：禁用终端内 REPL
 + `--protocal`：指定服务器版本（可选，不指定时自动检测）
 + `--owner`: 指定 REPL 上下文内 `owner()` 函数返回的玩家
 + `--enable-tcp-repl`：启用基于 TCP 连接的远程 REPL
   * `--tcp-repl-port`：TCP 远程 REPL 的服务端口（可选，默认值 2121）
 + `--remote-repl-passcode-length`：远程 REPL 的服务口令强度（可选，默认值 8）

## 基于 TCP 连接的远程 REPL

在启动时加上 `--enable-tcp-repl` 选项即可启用基于 TCP 连接的远程 REPL。使用 `scripts/tcp-repl-client.mjs` 作为客户端连接到 REPL 服务。这个 TCP 数据流不是加密的，故出于安全考虑，该服务强制绑定 host 在 127.0.0.1（这意味着你只能从本地连接到它），你可以使用一个 TCP 端口转发工具（例如 socat）来将 TCP 连接转发到远程服务器。

## REPL

REPL 上下文内预先定义了如下变量/函数/类型：

 + `PI`：常数，等于 `Math.PI`
 + `bot`：机器人对象
 + `Vec3`：3 维向量类型
 + `debug`：调试日志模块
 + `mineflayer`: mineflayer 模块默认导出
 + `mcdata`: minecraft-data 模块在 `bot.version` 版本下的导出
 + `lib.utils`: compass-utils 模块导出
 + `lib.cctl`: compass-control 模块导出
 + `lib.flyctl`: compass-fly-control 模块导出
 + `sc.pos()`: 缩写，返回 `bot.entity.position`
 + `sc.debug_cctl()`：缩写，等价于 `debug.enable('compass-control')`
 + `sc.debug_fctl()`：缩写，等价于 `debug.enable('compass-fly-control')`
 + `sc.sleep`：缩写，等价于 `lib.utils.asyncSleep`
 + `sc.tossHeld()`：缩写，等价于 `bot.tossStack(bot.heldItem)`
 + `bb`：所有 REPL 实例的共享数据
