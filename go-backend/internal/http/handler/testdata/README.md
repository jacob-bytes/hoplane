# GeoIP test data

`GeoIP2-Country-Test.mmdb` comes from the MaxMind-DB test data:

https://github.com/maxmind/MaxMind-DB/tree/main/test-data

It is used only by `geoip_test.go` to exercise the MMDB lookup without
shipping a production country database in the repository.
