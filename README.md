# Compass Bot

## 登录

在项目根目录下创建 `credentials.json`，包含如下内容：

```json
{
	"endpoint": "Yggdrasil API的调用点",
	"username": "用户名",
	"password": "密码"
}
```

## 运行

```sh
node index.js <server_ip:server_port> --version=<minecraft_version> --owner=<bot_owner>
```
