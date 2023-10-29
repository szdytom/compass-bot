# Compass Bot

## 安装

运行下面命令安装 Node.JS 的依赖包：

```sh
npm i
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
node index.mjs profile@host:port
```
