"use strict";

System.register(["lodash", "./util.js", "./signer.js"], function (_export, _context) {
  "use strict";

  var _, Util, CmsSigner, _createClass, GenericDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_utilJs) {
      Util = _utilJs.Util;
    }, function (_signerJs) {
      CmsSigner = _signerJs.CmsSigner;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export("GenericDatasource", GenericDatasource = function () {
        function GenericDatasource(instanceSettings, $q, backendSrv, templateSrv) {
          _classCallCheck(this, GenericDatasource);

          this.type = instanceSettings.type;
          this.datasourceId = instanceSettings.id;
          this.aliyunUserId = instanceSettings.jsonData.userId;
          this.basePath = instanceSettings.url;
          this.name = instanceSettings.name;
          this.jsonData = instanceSettings.jsonData;
          this.q = $q;
          this.backendSrv = backendSrv;
          this.templateSrv = templateSrv;
          this.util = new Util(templateSrv);
          this.headers = { "Content-Type": "application/json" };
          this.cmsVersion = "2018-03-08";
          this.ecsVersion = "2014-05-26";
          this.ecsBasePath = "https://ecs.aliyuncs.com";
          this.rdsVersion = "2014-08-15";
          this.rdsBasePath = "https://rds.aliyuncs.com";
          this.cacheMeta = new Map();
        }

        _createClass(GenericDatasource, [{
          key: "query",
          value: function query(options) {
            var _this = this;

            var requests = [];
            var result = [];
            options.targets.forEach(function (target) {
              //非空参数判空处理
              if (!target.project || !target.metric || !target.ycol || !target.xcol) {
                return;
              }
              //默认数据
              var ycol = target.ycol;
              var xcol = target.xcol;
              var describe = !target.describe ? target.describe : target.describe + ".";
              //处理模版
              var project = _this.util.exists(target.project) ? _this.util.resolve(target.project, {}) : target.project;
              var metric = _this.util.exists(target.metric) ? _this.util.resolve(target.metric, {}) : target.metric;
              var period = _this.util.exists(target.period) ? _this.util.resolve(target.period, {}) : target.period;
              var group = _this.util.exists(target.group) ? _this.util.resolve(target.group, {}) : target.group;
              //处理数组模版
              var dimensions = "";

              var dimensions_variables = [];

              target.dimensions.forEach(function (dimension) {
                _this.util.exists(dimension) ? dimensions_variables.push(_this.util.resolve(dimension, {})) : dimensions_variables.push(dimension);
              });
              var ycol_variables = [];
              ycol.forEach(function (y_col) {
                y_col.indexOf("$") != -1 ? ycol_variables.push(_this.util.resolve(y_col, {})) : ycol_variables.push(y_col);
              });
              ycol = ycol_variables.length > 0 ? ycol_variables : ycol;

              //自定义监控(acs_custom)、日志监控(acs_logMonitor)处理,只取下标为0的数据
              if (project.indexOf("acs_custom") != -1 || project.indexOf("acs_logMonitor") != -1) {
                var dimensionAcsJson = target.dimensions[0];
                var dimensionAcsObj = {
                  groupId: group.toString(),
                  dimension: dimensionAcsJson.replace(/\&/gi, "%26").replace(/\{/gi, "%7B").replace(/\}/gi, "%7D")
                };
                dimensions = JSON.stringify(dimensionAcsObj);
              } else {
                //正常数据
                dimensions = "";
                dimensions_variables.forEach(function (dimension, i) {
                  if (typeof dimension == "string") {
                    dimension = dimension.includes("{") ? dimension : "{" + dimension;
                    dimension = dimension.includes("}") ? dimension : dimension + "}";
                    // dimension = dimension.includes("\\") ? dimension.replace("\\/gi", "\\\\") : dimension;
                    dimensions += dimension + ",";
                  } else {
                    dimension.forEach(function (dimension_i) {
                      dimension_i = dimension_i.includes("{") ? dimension_i : "{" + dimension_i;
                      dimension_i = dimension_i.includes("}") ? dimension_i : dimension_i + "}";
                      // dimension = dimension.includes("\\") ? dimension.replace("\\/gi", "\\\\") : dimension;

                      dimensions += dimension_i + ",";
                    });
                  }
                });
                dimensions = dimensions.substring(0, dimensions.length - 1);
                dimensions = "[" + dimensions + "]";
                dimensions = dimensions.replace(/\&/gi, "%26").replace(/\{/gi, "%7B").replace(/\}/gi, "%7D");
              }
              var target_keys = [];
              var resource = "";
              if (_this.isEmpty(project) || _this.isEmpty(metric) || _this.isEmpty(xcol) || ycol.length == 0) {
                return;
              }
              _this.queryMetricMeta(project, metric).then(function (response) {
                resource = response;
                if (resource.length == 0 || _this.isEmpty(resource[0].Dimensions)) {
                  return;
                }
                var target_key_arr = resource[0].Dimensions.split(",");
                target_key_arr.forEach(function (value) {
                  if (target_key_arr.length == 1) {
                    target_keys.push(value);
                  } else {
                    if (value != "userId") {
                      target_keys.push(value);
                    }
                  }
                });
              });

              //拼接url参数
              var queryConcat = "/?Action=QueryMetricList&Length=1000&Project=" + project + "&Metric=" + metric + "&Period=" + period + "&Dimensions=" + dimensions + "&StartTime=" + parseInt(options.range.from._d.getTime()) + "&EndTime=" + parseInt(options.range.to._d.getTime());

              //定义Promise元数据、根据URL发起请求
              var request = _this.doNextToken(queryConcat, "", 0, "list").then(function (response) {
                var resResult = [];
                _this.dataGroupByKeys(response, target_keys).then(function (dataMap) {
                  dataMap.forEach(function (value, key) {

                    ycol.map(function (ycolTarget) {
                      var dataPoints = [];

                      value.forEach(function (valueObj) {
                        var dataPoint = [];
                        dataPoint.push(valueObj[ycolTarget], valueObj[xcol]);
                        // 封装返回目标的第二层数组值
                        dataPoints.push(dataPoint);
                        // 封装返回目标的第三层数组值
                      });

                      resResult.push({
                        target: describe + key + "." + ycolTarget,
                        datapoints: dataPoints
                      });
                    });
                  });

                  result = result.concat(typeof resResult == "string" ? JSON.parse(resResult) : resResult);
                });
              });
              requests.push(request);
            });

            // 统一单独处理返回值
            return Promise.all(requests.map(function (p) {
              return p.catch(function (e) {
                return e;
              });
            })).then(function () {
              return { data: result };
            });
          }
        }, {
          key: "dataGroupByKeys",
          value: async function dataGroupByKeys(list, keys) {
            var tmpMap = new Map();
            for (var i = 0; i < list.length; i++) {
              var dataPoint = list[i];

              var key_obj = {};
              var key_target = dataPoint[keys[0]];
              for (var j = 0; j < keys.length; j++) {
                var key = keys[j];
                var value = dataPoint[key];
                key_obj[key] = value;

                if (j > 0) {
                  key_target += "_" + value;
                }
              }
              var value_arr = [];
              if (tmpMap.has(key_target)) {
                value_arr = tmpMap.get(key_target);
              }

              value_arr.push(dataPoint);
              tmpMap.set(key_target, value_arr);
            }
            return tmpMap;
          }
        }, {
          key: "wait",
          value: function wait(ms) {
            return new Promise(function (resolve) {
              return setTimeout(resolve, ms);
            });
          }
        }, {
          key: "doNextToken",
          value: async function doNextToken(queryConcat, cursor, count, type) {
            var _this2 = this;

            var path = "";
            if (this.isEmpty(cursor)) {
              path = queryConcat;
            } else {
              path = queryConcat + "&Cursor=" + cursor;
            }
            var param = {
              path: path,
              method: "GET"
            };
            // 签名已拼接的待查询URL
            var query = this.buildRealUrl(param);
            if (_.isEmpty(query)) {
              var d = this.q.defer();
              d.resolve({ data: [] });
              return d.promise;
            }
            if ("list" == type) {
              await this.wait(1000);
            } else if ("last" == type) {
              await this.wait(100);
            }
            //定义Promise元数据、根据URL发起请求
            return this.backendSrv.datasourceRequest({
              url: query,
              method: "GET",
              headers: this.headers
            }).then(function (response) {
              var result = [];
              if (response.status == "200" && response.data.Code == "200") {
                result = angular.fromJson(response.data.Datapoints);
                if (count > 20) {
                  return result;
                }
                count++;
                var nextToken = response.data.Cursor;
                if (_this2.isEmpty(response.data.Cursor)) {
                  return result;
                } else {
                  return _this2.doNextToken(queryConcat, nextToken, count, type).then(function (data) {
                    return result.concat(data);
                  });
                }
              }
              return result;
            }).catch(function () {
              return [];
            });
          }
        }, {
          key: "testDatasource",
          value: function testDatasource() {
            var param = {
              path: "?Action=QueryMetricMeta&PageNumber=1&PageSize=1&Project=acs_ecs_dashboard",
              method: "GET"
            };
            return this.backendSrv.datasourceRequest({
              url: this.buildRealUrl(param),
              method: "GET"
            }).then(function (response) {
              var data = response.data;
              if (data.Code == "200" && data.Success == true) {
                return {
                  status: "success",
                  message: "Data source is working",
                  title: "Success"
                };
              } else {
                return {
                  status: "failure",
                  message: "Data source is not working",
                  title: "Failure"
                };
              }
            });
          }
        }, {
          key: "annotationQuery",
          value: function annotationQuery(options) {}
        }, {
          key: "metricFindQuery",
          value: function metricFindQuery(options) {
            var _this3 = this;

            var result = [];
            //接受一个参数
            var namespacesQuery = options.match(/^namespaces\(([^\)]+?)(,\s?([^,]+?))?\)/);
            namespacesQuery = namespacesQuery == null ? options.match(/^namespace\(([^\)]+?)(,\s?([^,]+?))?\)/) : namespacesQuery;
            if (namespacesQuery != null) {
              var filter = this.util.templateToStr(namespacesQuery[1]);
              return this.getProject().then(function (namespaces) {
                result = namespaces;
                if (!_this3.isEmpty(filter)) {
                  result = [];
                  namespaces.map(function (namespace) {
                    if (namespace.text.includes(filter)) {
                      result.push(namespace);
                    }
                  });
                }
                return result;
              });
            }

            //接受二个参数
            var metricsQuery = options.match(/^metrics\(([^,]+?),\s?([^,]+?)\)/);
            metricsQuery = metricsQuery == null ? options.match(/^metric\(([^,]+?),\s?([^,]+?)\)/) : metricsQuery;
            if (metricsQuery != null) {
              var namespace = this.util.templateToStr(metricsQuery[1]);
              var filter = this.util.templateToStr(metricsQuery[2]);

              result = [];
              return this.getMetrics(namespace).then(function (metrics) {
                result = metrics;
                if (!_this3.isEmpty(filter)) {
                  result = [];
                  metrics.map(function (metric) {
                    if (metric.text.includes(filter)) {
                      result.push(metric);
                    }
                  });
                }
                return result;
              });
            }

            //接受四个参数，过滤Tag提供key、value选择
            var tagFilterQuery = options.match(/^tagFilter\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?(.+))?\)/);
            tagFilterQuery = tagFilterQuery == null ? options.match(/^tagsFilter\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?(.+))?\)/) : tagFilterQuery;
            if (tagFilterQuery != null) {
              var type = this.util.templateToStr(tagFilterQuery[1]);
              var regionId = this.util.templateToStr(tagFilterQuery[2]);
              var tagType = this.isEmpty(tagFilterQuery[3]) ? "" : tagFilterQuery[3];
              var tagKey = this.isEmpty(tagFilterQuery[4]) ? "" : tagFilterQuery[4];
              var path = "/?Action=DescribeTags&PageNumber=1&PageSize=100&RegionId=" + regionId;
              var tagKeyFilter = [];
              if (tagKey) {
                path = "/?Action=DescribeTags&PageNumber=1&PageSize=100&RegionId=" + regionId + "&Tag.1.Key=" + tagKey;
                if (tagKey.indexOf("&Tag.2.Key=") != -1) {
                  var tagKeyArry = tagKey.split("&");
                  tagKeyArry.forEach(function (tagKeyInd) {
                    tagKeyFilter.push(tagKeyInd.substring(tagKeyInd.indexOf("Key=") == -1 ? 0 : tagKeyInd.indexOf("Key=") + 4));
                  });
                } else {
                  tagKeyFilter.push(tagKey);
                }

                if (tagKey.indexOf("Tag.1.Key=") != -1) {
                  path = "/?Action=DescribeTags&PageNumber=1&PageSize=100&RegionId=" + regionId + "&" + tagKey;
                }
                if (tagKey.indexOf("PageNumber=") != -1) {
                  path = "/?Action=DescribeTags&PageSize=100&RegionId=" + regionId + "&" + tagKey;
                }
                if (tagKey.indexOf("&") == 0) {
                  path = "/?Action=DescribeTags&PageSize=100&RegionId=" + regionId + tagKey;
                }
              }
              var nextToken = "";
              result = [];
              return this.tagsFilter(type.toUpperCase(), nextToken, path, tagType, tagKeyFilter).then(function (tagsList) {
                return _this3.util.arrayToMap(tagsList);
              });
            }

            //接受四个参数,暂不支持数组，提供dimensions选择
            var dimensionsQuery = options.match(/^dimension\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?(.+))?\)/);
            dimensionsQuery = dimensionsQuery == null ? options.match(/^dimensions\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?(.+))?\)/) : dimensionsQuery;
            if (dimensionsQuery != null) {
              var namespace = this.util.templateToStr(dimensionsQuery[1]);
              var metric = this.util.templateToStr(dimensionsQuery[2]);

              var instanceId = dimensionsQuery[3];
              var instanceId_array = this.util.exists(instanceId) ? this.util.resolve(instanceId, {}) : [];
              if (instanceId_array.length == 0) {
                if (this.isEmpty(instanceId)) {
                  instanceId_array = [];
                } else {
                  instanceId_array = this.util.strToArray(instanceId);
                }
              }
              var filter = dimensionsQuery[4];
              var filter_array = this.util.exists(filter) ? this.util.resolve(filter, {}) : [];
              if (filter_array.length == 0) {
                if (this.isEmpty(filter)) {
                  filter_array = [];
                } else {
                  filter_array = this.util.strToArray(filter);
                }
              }
              result = [];
              return this.getDimensions(namespace, metric, "", "", []).then(function (dimensions) {
                var is_instanceId_bool = _this3.isEmpty(instanceId);
                var is_filter_bool = _this3.isEmpty(filter);
                if (is_instanceId_bool) {
                  result = dimensions;
                } else {
                  var instanceId_result = [];
                  dimensions.map(function (dimension) {
                    instanceId_array.forEach(function (i) {
                      if (dimension.text.includes(i)) {
                        instanceId_result.push(dimension);
                      }
                    });
                  });
                  if (is_filter_bool) {
                    result = instanceId_result;
                  } else {
                    instanceId_result.map(function (dimension) {
                      filter_array.forEach(function (i) {
                        if (dimension.text.includes(i)) {
                          result.push(dimension);
                        }
                      });
                    });
                  }
                }
                return result;
              });
            }

            //接受5个参数,暂不支持数组，提供tag选择
            var tagQuery = options.match(/^tag\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?(.+))?\)/);
            tagQuery = tagQuery == null ? options.match(/^tags\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?(.+))?\)/) : tagQuery;
            if (tagQuery != null) {
              var resourceId = tagQuery[4];
              var resourceId_array = this.util.exists(resourceId) ? this.util.resolve(resourceId, {}) : [];
              if (resourceId_array.length == 0) {
                if (this.isEmpty(resourceId)) {
                  resourceId_array = [];
                } else {
                  resourceId_array = [];
                  resourceId_array = this.util.strToArray(resourceId);
                }
              }
              var tag = tagQuery[5];
              var tag_array = this.util.exists(tag) ? this.util.resolve(tag, {}) : [];
              if (tag_array.length == 0) {
                if (this.isEmpty(tag)) {
                  tag_array = [];
                } else {
                  tag_array = [];
                  tag_array = this.util.strToArray(tag);
                }
              }
              return this.listTagResources(tagQuery[1].toUpperCase(), tagQuery[2], tagQuery[3], resourceId_array, tag_array);
            }
            return [];
          }
        }, {
          key: "getProject",
          value: function getProject() {
            var _this4 = this;

            var param = {
              path: "?Action=QueryProjectMeta&PageNumber=1&PageSize=2000",
              method: "GET"
            };
            return this.backendSrv.datasourceRequest({
              url: this.buildRealUrl(param),
              method: "GET"
            }).then(function (response) {
              var result = [];
              var data = response.data;
              if (data.Code == "200" && data.Success == true) {
                data.Resources.Resource.map(function (resource) {
                  if (!_this4.isEmpty(resource.Namespace)) {
                    result.push(resource.Namespace);
                  }
                });
              }
              //增加自定义监控、日志监控选项
              result.push("acs_logMonitor_" + _this4.aliyunUserId);
              result.push("acs_customMetric_" + _this4.aliyunUserId);
              return _this4.util.arrayToMap(result);
            }).catch(function (error) {
              console.log(error);
              return;
            });
          }
        }, {
          key: "getMetrics",
          value: function getMetrics(project) {
            var _this5 = this;

            var param = {
              path: "?Action=QueryMetricMeta&PageNumber=1&PageSize=2000&Project=" + project,
              method: "GET"
            };
            return this.backendSrv.datasourceRequest({
              url: this.buildRealUrl(param),
              method: "GET"
            }).then(function (response) {
              var data = response.data;
              if (data.Code == "200" && data.Success == true) {
                var result = [];
                data.Resources.Resource.map(function (resource) {
                  if (!_this5.isEmpty(resource.MetricName)) {
                    result.push(resource.MetricName);
                  }
                });
                return _this5.util.arrayToMap(result);
              }
            }).catch(function (error) {
              console.log(error);
              return;
            });
          }
        }, {
          key: "getPeriod",
          value: function getPeriod(project, metric) {
            var _this6 = this;

            var param = {
              path: "?Action=QueryMetricMeta&PageNumber=1&PageSize=1&Project=" + project + "&Metric=" + metric,
              method: "GET"
            };
            return this.backendSrv.datasourceRequest({
              url: this.buildRealUrl(param),
              method: "GET"
            }).then(function (response) {
              var data = response.data;
              if (data.Code == "200" && data.Success == true) {
                var period = [];
                var resource = data.Resources.Resource;
                if (resource.length > 0 && !_this6.isEmpty(resource[0].Periods)) {
                  period = resource[0].Periods.split(",");
                  period.splice(0, 0, "auto");
                }
                return _this6.util.arrayToMap(period);
              }
            }).catch(function (error) {
              console.log(error);
              return;
            });
          }
        }, {
          key: "getStatistics",
          value: function getStatistics(project, metric) {
            var _this7 = this;

            var param = {
              path: "?Action=QueryMetricMeta&PageNumber=1&PageSize=1&Project=" + project + "&Metric=" + metric,
              method: "GET"
            };
            return this.backendSrv.datasourceRequest({
              url: this.buildRealUrl(param),
              method: "GET"
            }).then(function (response) {
              var data = response.data;
              if (data.Code == "200" && data.Success == true) {
                var statistics = [];
                var resource = data.Resources.Resource;
                if (resource.length > 0 && !_this7.isEmpty(resource[0].Statistics)) {
                  statistics = resource[0].Statistics.split(",");
                }
                return _this7.util.arrayToMap(statistics);
              }
            }).catch(function (error) {
              console.log(error);
              return;
            });
          }
        }, {
          key: "getGroups",
          value: function getGroups() {
            var _this8 = this;

            var param = {
              path: "?Action=ListMyGroups&PageNumber=1&PageSize=9000",
              method: "GET"
            };
            return this.backendSrv.datasourceRequest({
              url: this.buildRealUrl(param),
              method: "GET"
            }).then(function (response) {
              var data = response.data;
              if (data.Code == "200" && data.Success == true) {
                var result = [];
                var resource = data.Resources.Resource;
                var i = resource.length;
                while (i--) {
                  var group = resource[i];
                  var groupInfo = [];
                  var groupId = group.GroupId;
                  var groupName = group.GroupName;
                  if (_this8.isEmpty(groupId) || _this8.isEmpty(groupName)) {
                    continue;
                  }
                  groupInfo.push(groupId, groupName + " / " + groupId);
                  result.push(groupInfo);
                }
                return _.map(result, function (d, i) {
                  return { text: d[1], value: d[0] };
                });
              }
            }).catch(function (error) {
              console.log(error);
              return;
            });
          }
        }, {
          key: "getDimensions",
          value: function getDimensions(project, metric, period, dimensions, resource) {
            var _this9 = this;

            if (project.indexOf("acs_customMetric") != -1 || project.indexOf("acs_logMonitor") != -1) {
              return;
            }
            var endTime = new Date().getTime();
            var startTime = endTime - 15 * 60 * 1000;
            // TODO
            var queryConcat = "?Action=QueryMetricLast&Period=" + period + "&Project=" + project + "&Metric=" + metric + "&StartTime=" + startTime + "&EndTime=" + endTime;
            return this.doNextToken(queryConcat, "", 0, "last").then(function (data) {
              if (data.length == 0) {
                return [];
              }
              // 构建可选参数dimensions
              if (!_this9.isEmpty(resource)) {
                return _this9.dimensionData(data, resource, dimensions);
              } else {
                return _this9.queryMetricMeta(project, metric).then(function (response) {
                  resource = response;
                  if (_this9.isEmpty(resource) || _this9.isEmpty(resource[0].Dimensions)) {
                    return [];
                  }
                  return _this9.dimensionData(data, resource, dimensions);
                });
              }
            }).catch(function (error) {
              console.log(error);
              return [];
            });
          }
        }, {
          key: "dimensionData",
          value: async function dimensionData(data, resource, dimensions) {
            var result = [];
            var dimension = resource[0].Dimensions.split(",");

            // var datapoints = JSON.parse(data.Datapoints);
            data.map(function (datapoint) {
              var datapointInfo = '{"';
              dimension.forEach(function (value, index) {
                value = value.replace(/"/g, "");
                if (value != "userId" || value == "userId" && dimension.length == 1) {
                  if (datapoint[value].indexOf(":\\") != -1) {
                    datapointInfo += value + '":"' + datapoint[value] + '\\"';
                  } else {
                    datapointInfo += value + '":"' + datapoint[value] + '"';
                  }
                  if (index == dimension.length - 1) {
                    datapointInfo += "}";
                  } else {
                    datapointInfo += ',"';
                  }
                }
              });
              //去重
              if (result.length == 0) {
                if (dimensions.length == 0) {
                  result.push(datapointInfo);
                } else if (dimensions.length > 0 && !dimensions.includes(datapointInfo)) {
                  result.push(datapointInfo);
                }
              } else if (result.length > 0 && !result.includes(datapointInfo)) {
                if (dimensions.length == 0) {
                  result.push(datapointInfo);
                } else if (dimensions.length > 0 && !dimensions.includes(datapointInfo)) {
                  result.push(datapointInfo);
                }
              }
            });
            return this.util.arrayToMap(result);
          }
        }, {
          key: "queryMetricMeta",
          value: async function queryMetricMeta(project, metric) {
            var _this10 = this;

            var rand = Math.floor(Math.random() * 4) + 5;
            await this.wait(100 * rand);

            var resource = this.cacheMeta.get(project + "_" + metric);
            if (this.isEmpty(resource)) {
              var param = {
                path: "?Action=QueryMetricMeta&PageNumber=1&PageSize=1&Project=" + project + "&Metric=" + metric,
                method: "GET"
              };
              return this.backendSrv.datasourceRequest({
                url: this.buildRealUrl(param),
                method: "GET"
              }).then(function (response_meta) {
                var data_meta = response_meta.data;
                if (data_meta.Code == "200" && data_meta.Success == true) {
                  resource = data_meta.Resources.Resource;
                  _this10.cacheMeta.set(project + "_" + metric, resource);
                  return resource;
                }
              });
            } else {
              return resource;
            }
          }
        }, {
          key: "tagsFilter",
          value: function tagsFilter(type, nextToken, path, tagType, tagKeyFilter) {
            var reqUrl = path;
            if (!this.isEmpty(nextToken)) {
              reqUrl += "&NextToken=" + nextToken;
            }
            var param = {
              path: reqUrl,
              method: "GET"
            };
            var realUrl = "";
            if ("ECS" == type) {
              realUrl = this.buildECSRealUrl(param);
              return this.backendSrv.datasourceRequest({
                url: realUrl,
                method: "GET"
              }).then(function (response) {
                var result = [];
                var data = response.data;
                var tags = data.Tags.Tag;
                if (tags.length > 0) {
                  tags.forEach(function (tag) {
                    if ("key" == tagType) {
                      if (!result.includes(tag.TagKey)) {
                        result.push(tag.TagKey);
                      }
                    } else if ("value" == tagType) {
                      if (tagKeyFilter.includes(tag.TagKey) || tagKeyFilter.length == 0) {
                        var value = tag.TagKey + ":/:" + tag.TagValue;
                        if (!result.includes(value)) {
                          result.push(value);
                        }
                      }
                    }
                  });
                }
                return result;
              });
            } else if ("RDS" == type) {
              realUrl = this.buildRDSRealUrl(param);
              return this.backendSrv.datasourceRequest({
                url: realUrl,
                method: "GET"
              }).then(function (response) {
                var result = [];
                var data = response.data;
                var tags = data.Items.TagInfos;
                if (tags.length > 0) {
                  tags.forEach(function (tag) {
                    if ("key" == tagType) {
                      if (!result.includes(tag.TagKey)) {
                        result.push(tag.TagKey);
                      }
                    } else if ("value" == tagType) {
                      if (tagKeyFilter.includes(tag.TagKey) || tagKeyFilter.length == 0) {
                        var value = tag.TagKey + ":/:" + tag.TagValue;
                        if (!result.includes(value)) {
                          result.push(value);
                        }
                      }
                    }
                  });
                }
                return result;
              });
            }
          }
        }, {
          key: "listTagResources",
          value: function listTagResources(type, regionId, resourceType, resourceId, tag) {
            var _this11 = this;

            type = this.isEmpty(type) ? "ECS" : type;
            regionId = this.isEmpty(regionId) ? "cn-hangzhou" : regionId;
            if ("ECS" == type) {
              resourceType = this.isEmpty(resourceType) ? "instance" : resourceType;
            } else if ("RDS" == type) {
              resourceType = this.isEmpty(resourceType) ? "INSTANCE" : resourceType;
            }
            var path = "/?Action=ListTagResources&RegionId=" + regionId + "&ResourceType=" + resourceType;
            for (var i = 0; i < resourceId.length; i++) {
              if (50 > i) {
                var v = resourceId[i];
                if (!this.isEmpty(v)) {
                  path += "&ResourceId." + (parseInt(i) + 1).toString() + "=" + v;
                }
              }
            }
            var tag_key_array = [];
            var tag_value_array = [];
            tag.forEach(function (t) {
              if (!_this11.isEmpty(t)) {
                if (t.indexOf(":/:") != -1) {
                  var t_split = t.split(":/:");
                  if (!tag_key_array.includes(t_split[0])) {
                    tag_key_array.push(t_split[0]);
                  }
                  if (!tag_value_array.includes(t_split[1])) {
                    tag_value_array.push(t_split[1]);
                  }
                }
              }
            });
            if (tag_key_array.length > 0) {
              for (var i = 0; i < tag_key_array.length; i++) {
                var key = tag_key_array[i];
                path += "&Tag." + (parseInt(i) + 1).toString() + ".Key=" + key;
              }
            } else if (tag_key_array.length == 0 && tag.length > 0) {
              for (var i = 0; i < tag.length; i++) {
                var key = tag[i];
                path += "&Tag." + (parseInt(i) + 1).toString() + ".Key=" + key;
              }
            }
            var nextToken = "";
            return this.tagList(type, nextToken, path, tag_value_array).then(function (rep) {
              var distinct_result = [];
              rep.forEach(function (instanceId) {
                if (!distinct_result.includes(instanceId)) {
                  distinct_result.push(instanceId);
                }
              });
              return _this11.util.arrayToMap(distinct_result);
            });
          }
        }, {
          key: "tagList",
          value: function tagList(type, nextToken, path, tag_value_array) {
            var _this12 = this;

            var reqUrl = path;
            if (!this.isEmpty(nextToken)) {
              reqUrl += "&NextToken=" + nextToken;
            }
            var param = {
              path: reqUrl,
              method: "GET"
            };
            var realUrl = "";
            if ("ECS" == type) {
              realUrl = this.buildECSRealUrl(param);
            } else if ("RDS" == type) {
              realUrl = this.buildRDSRealUrl(param);
            }
            return this.backendSrv.datasourceRequest({
              url: realUrl,
              method: "GET"
            }).then(function (response) {
              var result = [];
              var data = response.data;
              var tagResource = data.TagResources.TagResource;
              if (tagResource.length > 0) {
                tagResource.forEach(function (resource) {
                  if (tag_value_array.length > 0) {
                    if (tag_value_array.includes(resource.TagValue)) {
                      result.push(resource.ResourceId);
                    }
                  } else {
                    result.push(resource.ResourceId);
                  }
                });
              }
              if (_this12.isEmpty(data.NextToken)) {
                return result;
              } else {
                return _this12.tagList(type, data.NextToken, path, tag_value_array).then(function (nextList) {
                  return result.concat(nextList);
                });
              }
            });
          }
        }, {
          key: "buildRealUrl",
          value: function buildRealUrl(param) {
            return "/api/datasources/" + this.datasourceId + "/resources/proxy_aliyun_cms_pop" + param.path;
          }
        }, {
          key: "buildECSRealUrl",
          value: function buildECSRealUrl(param) {
            return "/api/datasources/" + this.datasourceId + "/resources/proxy_aliyun_ecs_pop" + param.path;
          }
        }, {
          key: "buildRDSRealUrl",
          value: function buildRDSRealUrl(param) {
            return "/api/datasources/" + this.datasourceId + "/resources/proxy_aliyun_rds_pop" + param.path;
          }
        }, {
          key: "isEmpty",
          value: function isEmpty(obj) {
            var re = new RegExp("^[ ]+$");
            if (!obj || obj == "null" || obj == null || obj == " " || obj == "" || obj == '""' || re.test(obj) || typeof obj == "undefined") {
              return true;
            } // 为空
            return false; // 不为空
          }
        }]);

        return GenericDatasource;
      }());

      _export("GenericDatasource", GenericDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map
