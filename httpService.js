/*
    author: Jamie Altizer
    license: MIT
    version: 0.1.0
*/

;(function () {
    'use strict';

    angular.module('HttpService', [])
        .provider('httpService',
            function HttpServiceProvider() {
                //Defaults for the settings that users can configure for the app
                var loggers = {
                        success: function() {},
                        error: function() {}
                    },
                    internetCheck = function() { return true; },
                    headers = {};

                return {
                        //The following methods are used to default certain settings for HttpService throughout an application
                        setSuccessLogger: function(callback) {
                            loggers.success = callback;
                            return this;
                        },
                        setErrorLogger: function(callback) {
                            loggers.error = callback;
                            return this;
                        },
                        setInternetCheck: function(callback) {
                            internetCheck = callback;
                            return this;
                        },
                        setHeader: function(name, value) {
                            headers[name] = value;
                        },
                        setAuthorization: function(value) {
                            headers.Authorization = value;
                        },


                        //This method is called each time a the HttpService is requested, configuration values are applied
                        // for each instantiation
                        $get: ['$q', '$http', '$timeout', function httpServiceFatory($q, $http, $timeout) {
                            function HttpService() {

                                function FakePromise() {
                                    function Promise() {}

                                    var _callbacks = {
                                        'success': [],
                                        'error': [],
                                        'finally': []
                                    };

                                    Promise.prototype.actions = {
                                        success: function() {
                                                for(var i = 0, len = _callbacks.success.length; i < len; ++i) {
                                                    _callbacks.success[i].apply(this, arguments);
                                                }
                                            },
                                        error: function() {
                                                for(var i = 0, len = _callbacks.error.length; i < len; ++i) {
                                                    _callbacks.error[i].apply(this, arguments);
                                                }
                                            },
                                        finally: function() {
                                                for(var i = 0, len = _callbacks.finally.length; i < len; ++i) {
                                                    _callbacks.finally[i].apply(this, arguments);
                                                }
                                            }
                                    };
                                    Promise.prototype.public = {
                                        success: function (func) { _callbacks.success.push(func); return this; },
                                        error: function (func) { _callbacks.error.push(func); return this; },
                                        finally: function (func) { _callbacks.finally.push(func); return this; }
                                    };

                                    return new Promise();
                                }

                                function Config() {
                                    var userConfig = {},
                                        useCORS = false;

                                    this.addConfigValue = function (property, value) {
                                            userConfig = userConfig || {};
                                            setDefault(userConfig, property, value);
                                        };
                                    this.setHeader = function (header, value) {
                                            this.addConfigValue('headers', {});
                                            userConfig.headers[header] = value;
                                        };
                                    this.handleCORS = function () {
                                            if (useCORS) {
                                                $http.defaults.useXDomain = true;
                                                delete $http.defaults.headers.common['X-Requested-With'];
                                            }
                                        };
                                    this.useCORS = function(value) {
                                            useCORS = value;
                                        };
                                    this.cleanup = function() {
                                            useCORS = false;
                                            userConfig = {};
                                    };
                                    this.set = function(config) {
                                            userConfig = config;
                                        };
                                    this.get = function() {
                                            return userConfig;
                                        };
                                }

                                function Deferred() {
                                    function deferred(callback) {
                                        var d = $q.defer(),
                                            my = new FakePromise();

                                        callback(d);

                                        d.promise
                                            .then(function (data) {
                                                    my.actions.success(data);
                                                },
                                                function (data) {
                                                    my.actions.error(data);
                                                })
                                            .finally(function (data) {
                                                my.actions.finally(data);
                                            });
                                        return my.public;
                                    }

                                    return {
                                        loopback: function (data, timeout_duration) {
                                                return deferred(function(d) {
                                                        $timeout(function () {
                                                            d.resolve(data);
                                                        }, timeout_duration);
                                                    });
                                            },
                                        defer: function(callback) {
                                                return deferred(callback);
                                            }
                                    };
                                }

                                var config = new Config(),
                                    internetCheck = null,
                                    successLogger = null,
                                    errorLogger = null;



                                function setDefault(obj, property, value) {
                                    if (!obj.hasOwnProperty(property)) {
                                        obj[property] = value;
                                    }
                                }

                                function httpCallback(callback, logger, deferred) {
                                    return function() {
                                        if (callback && typeof callback === 'function') {
                                            callback.apply({}, arguments);
                                        }

                                        config.cleanup();
                                        logger.apply({}, arguments);
                                        deferred.apply({}, arguments);
                                    };
                                }

                                function httpNoInternet() {
                                    if (internetCheck() === false) {
                                        config.cleanup();
                                        return (new Deferred()).loopback([], 1000);
                                    }
                                }

                                this.setConfig = function (config) {
                                    config.set(config);
                                    return this;
                                };

                                this.setInternetCheck = function(callback) {
                                    internetCheck = callback;
                                    return this;
                                };

                                this.setSuccessLogger = function(callback) {
                                    successLogger = callback;
                                    return this;
                                };

                                this.setErrorLogger = function(callback) {
                                    errorLogger = callback;
                                    return this;
                                };

                                this.setHeader = function (name, value) {
                                    config.setHeader(name, value);
                                    return this;
                                };

                                this.setAuthorization = function (value) {
                                    config.setHeader('Authorization', value);
                                    return this;
                                };

                                this.useCORS = function () {
                                    config.useCORS(true);
                                    return this;
                                };

                                this.get = function (url, successCallback, failureCallback) {
                                    httpNoInternet();
                                    config.handleCORS();

                                    return (new Deferred()).defer(function (d) {
                                                $http.get(url, config.get())
                                                        .success(httpCallback(successCallback, successLogger, d.resolve))
                                                        .error(httpCallback(failureCallback, errorLogger, d.reject));
                                            });
                                };

                                this.post = function (url, data, successCallback, failureCallback) {
                                    httpNoInternet();
                                    config.handleCORS();

                                    data = data || {};
                                    return (new Deferred()).defer(function (d) {
                                                $http.post(url, data, config.get())
                                                    .success(httpCallback(successCallback, successLogger, d.resolve))
                                                    .error(httpCallback(failureCallback, errorLogger, d.reject));
                                            });
                                };

                                this.delete = function (url, successCallback, failureCallback) {
                                    httpNoInternet();
                                    config.handleCORS();

                                    return (new Deferred()).defer(function (d) {
                                                $http.delete(url, config.get())
                                                    .success(httpCallback(successCallback, successLogger, d.resolve))
                                                    .error(httpCallback(failureCallback, errorLogger, d.reject));
                                            });
                                };

                                this.jsonp = function (url, successCallback, failureCallback) {
                                    httpNoInternet();

                                    return (new Deferred()).defer(function (d) {
                                                $http.jsonp(url, config.get())
                                                    .success(httpCallback(successCallback, successLogger, d.resolve))
                                                    .error(httpCallback(failureCallback, errorLogger, d.reject));
                                            });
                                };

                                this.loopback = (new Deferred()).loopback;
                            }
                            var service = new HttpService();

                            service
                                .setSuccessLogger(loggers.success)
                                .setErrorLogger(loggers.error)
                                .setInternetCheck(internetCheck);

                            for(var p in headers) {
                                service.setHeader(p, headers[p]);
                            }
                            return service;
                    }]
                };
            });
})();
