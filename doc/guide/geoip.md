# IP 国家库

面板优先读取 MaxMind GeoLite2 Country 数据库，用于在新建或编辑服务器时自动填写国家/地区。

## 镜像内置

后端镜像在构建时下载固定版本的 `GeoLite2-Country.mmdb`，并校验 SHA-256，运行路径为：

```text
/usr/share/hoplane/GeoLite2-Country.mmdb
```

GeoLite2 data created by MaxMind, available from https://www.maxmind.com.

## 覆盖路径

如需使用自己的数据库，设置：

```text
HOPLANE_GEOIP_MMDB=/path/to/GeoLite2-Country.mmdb
```

## 其他来源

未找到 MMDB 时，面板会依次尝试：

1. `HOPLANE_GEOIP_CSV` 指定的 `cidr,country` CSV；
2. `HOPLANE_GEOIP_URL` 指定的 HTTP 查询服务；
3. 按节点名称推断国旗。
