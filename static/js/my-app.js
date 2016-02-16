angular.module( "MyApp",  ['puElasticInput'] )

// TODO: tran summation
// TODO: separate controllers for subsets of accounts? then the summation html could be ng-included.

/**
 * TODO:
 */
.controller( "MainController",   ["$scope", "_", "Logger", "DateUtils", "Datastore",
                         function( $scope,   _,   Logger,   DateUtils,   Datastore ) {

    Logger.info("MainController: alive!");

    /**
     * Set $scope.accounts 
     * Set $scope.bankAndCreditAccounts
     */
    var setAccounts = function( accounts ) {
        $scope.accounts = accounts;
        $scope.bankAndCreditAccounts = _.filter( $scope.accounts, 
                                                 function(account) { 
                                                     return account.accountType == "credit" || account.accountType == "bank";
                                                 } );
        $scope.investmentAccounts = _.filter( $scope.accounts, 
                                                 function(account) { 
                                                     return ! (account.accountType == "credit" || account.accountType == "bank");
                                                 } );
    };

    /**
     * Called when a tran is ACKed.   Remove the tran from the list.
     */
    var onAckTran = function(theEvent, tranId) {

        Logger.info("MainController.onAckTran: tranId=" + tranId);

        // remove it from the list locally (faster)
        $scope.newTrans = _.filter( $scope.newTrans, function(tran) { return tran._id != tranId } );
    };


    /**
     * Listens for $addTranTag events.
     */
    var onAddTranTag = function(theEvent, tag) {
        Logger.info("MainController.onAddTranTag: tag=" + tag + ", $scope.tags=" + JSON.stringify($scope.tags));

        if ( ! _.contains($scope.tags, tag) ) {
            $scope.tags.push(tag);
        }
    };

    /**
     * @return net worth (sum of value for all $scope.accounts)
     */
    var sumField = function(accounts, fieldName) {
        var retMe = _.reduce(accounts, 
                             function(memo, account) { 
                                 return memo + account[fieldName]
                             }, 
                             0);
        Logger.fine("MainController.sumField: fieldName=" + fieldName + ": " + retMe);
        return retMe;
    };

    /**
     * @return net worth (sum of value for all $scope.accounts)
     */
    var getNetWorth = function() {
        return sumField( $scope.accounts, "value");
    };
        
    /**
     * @return net worth performance (sum of value for all $scope.accounts[fieldName])
     */
    var getNetWorthPerf = function(fieldName) {
        return sumField( $scope.accounts, fieldName);
    };


    /**
     * Export to $scope
     */
    $scope.accounts = [];
    $scope.bankAndCreditAccounts = [];
    $scope.newTrans = [];
    $scope.DateUtils = DateUtils;
    $scope.getNetWorth = getNetWorth;
    $scope.getNetWorthPerf = getNetWorthPerf;
    $scope.sumField = sumField;

    $scope.$on("$addTranTag", onAddTranTag );
    $scope.$on("$ackTran", onAckTran);

    /**
     * Init data
     */
    Datastore.fetchActiveAccounts().then( setAccounts );

    Datastore.fetchNewTrans()
             .then( function success(newTrans) { $scope.newTrans = newTrans; } ); 

    Datastore.fetchTags()
             .then( function success(tags) { $scope.tags = tags; } ); 

}])


/**
 * ng-controller for tran tagging <form>(s).
 * There's one of these controllers for each tran ($scope.tran).
 */
.controller( "TagFormController",   ["$scope", "_", "$rootScope", "Logger", "Datastore",
                            function( $scope,   _ ,  $rootScope,   Logger,   Datastore) {

    Logger.fine("TagFormController: alive!: $scope.tran=" + $scope.tran.amount);

    /**
     * @return true if the given string is null or empty
     */
    var isEmpty = function(s) {
        return angular.isUndefined(s) || !s || s.trim().length == 0;
    }

    /**
     * PUT the tag updates to the db.
     */
    var putTranTags = function() {
        Logger.info("TagFormController.putTranTags: " + JSON.stringify($scope.tran.tags));
        var putData = { "tags": $scope.tran.tags } ;
        Datastore.putTran( $scope.tran._id, putData );
    };

    /**
     * add a tag to the tran
     */
    var addTranTag = function(tag) {

        // Clear the auto-complete list and the input field.
        $scope.filteredTags = [];   
        $scope.inputTag = "";

        tag = (tag || "").trim();

        if (isEmpty(tag)) {
            return;
        }

        // Create tags field if it doesn't exist
        $scope.tran.tags = $scope.tran.tags || [];  

        if ( ! _.contains($scope.tran.tags, tag) ) {
            $scope.tran.tags.push(tag);
            putTranTags();

            // Refresh parent $scope.tags since we may have just added a brand new tag.
            // Safest way to do this is to via Event.
            Logger.info("TagFormController.addTranTag: $rootScope.$broadcast(event=$addTranTag, tag=" + tag + ")");
            $rootScope.$broadcast("$addTranTag", tag);
        }
    }

    /**
     * Called when the user hits 'enter' after typing in a tag.
     * Add the tag to the tran.
     */
    var onFormSubmit = function() {
        Logger.info("TagFormController.onFormSubmit: " + $scope.inputTag);
        addTranTag( $scope.inputTag )
    }

    /**
     * Remove the tag from the tran.
     */
    var removeTag = function(tag) {

        // remove it from the tags list 
        $scope.tran.tags = _.filter( $scope.tran.tags, function(t) { return t != tag; } );
        Logger.info("TagFormController.removeTag: " + tag + ", $scope.tran.tags=" + JSON.stringify($scope.tran.tags) );

        // Update the db
        putTranTags();
    };

    /**
     * Export to scope.
     */
    $scope.onFormSubmit = onFormSubmit;
    $scope.removeTag = removeTag;

    /**
     * Init data.
     */
    $scope.filteredTags = [];

}])


/**
 * The ACK button
 */
.controller( "TranAckFormController",   ["$scope", "$rootScope", "Logger", "Datastore",
                                function( $scope,   $rootScope,   Logger,   Datastore ) {

    Logger.fine("TranAckFormController: alive!");

    /**
     * Set hasBeenAcked=true for the given tran in the db.
     */
    var ackTran = function(tranId) {

        Logger.info("TranAckFormController.ackTran: tranId=" + tranId);

        // remove it from the list locally (faster)
        // TODO: $scope.newTrans = _.filter( $scope.newTrans, function(tran) { return tran._id != tranId } );

        // update the db.
        var putData = { "hasBeenAcked": true } ;
        Datastore.putTran( tranId, putData );

        Logger.info("TranAckFormController.ackTran: $rootScope.$broadcast(event=$ackTran, tranId=" + tranId + ")");
        $rootScope.$broadcast("$ackTran", tranId);
    };

    /**
     * Export to scope
     */
    $scope.ackTran = ackTran;

}])

/**
 * "Auto-fill" directive
 *
 * Usage:
 * <input ng-model="scopeField" tm-auto-fill="{fillStringList}" />
 *
 * {fillStringList} is the name of a scope field that contains the list of
 * potential auto-fill strings.
 *
 * As the user types, the first string in fillStringList that begins with
 * the typed text will be auto-filled into the input box.
 *
 */
.directive('tmAutoFill', [ "_", "$parse", "Logger",
                   function(_,   $parse,   Logger) {
    var directiveDefiningObj = {
        require: "ngModel",
        link: function($scope, element, attrs, ngModel) {

                  var fillStringList = $parse(attrs.tmAutoFill)($scope);
                  Logger.fine("directive::tmAutoFill.link: fillStringList=" + JSON.stringify(fillStringList));

                  var fillAndSelect = function( element, fillText ) {
                        var typedTextLen = element.val().length;
                        element.val( fillText );
                        element[0].setSelectionRange( typedTextLen , fillText.length );
                  };

                  var autofill = function(element) {
                      var fillStrings = _.filter( fillStringList, function(fillString) { return fillString.startsWith( element.val() ); } );

                      if (fillStrings.length > 0) {
                          fillAndSelect( element, fillStrings[0] );
                      }
                  };

                  element.on("input", function(event) {
                      Logger.fine("directive::tmAutoFill.oninput: "
                                        + "element.val()=" + element.val()
                                        + ", fillStringList=" + JSON.stringify(fillStringList)
                                       );

                      autofill( element );
                  });

                  /**
                   * @return true if the input element has selected text
                   */
                  var isTextSelected = function(element) {
                      return (element[0].selectionEnd > element[0].selectionStart);
                  }

                  var isBackspaceKey = function(keyEvent) {
                      return keyEvent.which == 8;
                  };

                  var isDeleteKey = function(keyEvent) {
                      return keyEvent.which == 46;
                  };

                  var isEnterKey = function(keyEvent) {
                      return keyEvent.which == 13;
                  };


                  element.on("keydown", function(keyEvent) {
                      Logger.fine("directive::tnWatchInput.keydown: $scope.inputTag=" + $scope.inputTag 
                                        + ", keyEvent.which=" + keyEvent.which
                                        + ", element.val()=" + element.val()
                                        + ", element.selectionStart=" + element[0].selectionStart
                                        + ", element.selectionEnd=" + element[0].selectionEnd
                                        );

                      // Because angular doesn't update the scope with the filled in portion of the input
                      if ( isEnterKey(keyEvent) ) {
                          ngModel.$setViewValue( element.val() );
                      }

                      // Handle backspace and delete ourselves.  Otherwise "oninput" will be driven
                      // and will re-autofill the input box.
                      if ( isBackspaceKey(keyEvent) || isDeleteKey(keyEvent) ) {

                          if ( isTextSelected(element) ) {
                              element.val( element.val().substring(0, element[0].selectionStart ) )
                          } else if (element.val().length > 0) {
                              element.val( element.val().substring(0, element.val().length - 1) )
                          }

                          keyEvent.preventDefault();
                      }

                  });
              }
    };
    return directiveDefiningObj;
}])


/**
 * TODO
 */
.controller( "AccountController",   ["$scope", "_", "$location", "Logger", "DateUtils", "Datastore",
                            function( $scope,   _ ,  $location,   Logger,   DateUtils,   Datastore) {

    Logger.info("AccountController: alive! $location.search=" + JSON.stringify($location.search()));

    /**
     * Render the current balance chart.
     */
    var renderValueChart = function( accountTimeSeries ) {
        Logger.info("AccountController.renderValueChart: ");

        // Get all date labels from earliest tran to today
        var fromTs = accountTimeSeries[ 0 ].timestamp * 1000;
        var fromDate = new Date( fromTs );
        var labels = DateUtils.createDateLabels( fromDate );
        
        // Get values.
        var values = new Array(labels.length);

        _.each( accountTimeSeries, 
                function(tsEntry) {
                    var i = DateUtils.dateDiff( 'd', fromTs, tsEntry.timestamp * 1000 );
                    values[i] = tsEntry.currentBalance;
                } );

        // Fill in the null's
        var lastNonNullValue = 0;
        for (var i=0; i < values.length; ++i) {
            if (values[i] == null) {
                values[i] = lastNonNullValue;
            } else {
                lastNonNullValue = values[i];
            }
        }

        // Sample the data if we have LOTS of it
        var sampleRate = Math.ceil(values.length / 100);
        Logger.info("AccountController.renderValueChart: sampleRate=" + sampleRate + ", values.length=" + values.length);

        // Setup data frame.
        var data = {
            labels: evenSample( sample(labels, sampleRate), 10 ),
            datasets: [
                {
                    label: "My First dataset",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "rgba(220,220,220,1)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    data: sample(values, sampleRate)
                }
            ]
        };

        // Get the context of the canvas element we want to select
        var valueChartCanvas = document.getElementById("valueChart").getContext("2d");
        var myValueChart = new Chart(valueChartCanvas).Line(data, {});
    };

    /**
     * TODO
     */
    var currencyToNumber = function(currStr) {
        return Number(currStr.replace(/[^0-9\.]+/g,""));
    }

    /**
     * TODO
     */
    var evenSample = function( arr, num ) {
        var i=0;
        var nth = Math.round( arr.length / num );
        Logger.fine("AccountController.evenSample: nth=" + nth + ", arr.length=" + arr.length);
        return _.map( arr, function(item) { return ( i++ % nth == 0 ) ? item : "" ; } );
    };

    /**
     * TODO
     */
    var sample = function( arr, everyNth) {
        var retMe = [];
        for (var i=0; i < arr.length; ++i) {
            if (i % everyNth == 0) {
                retMe.push(arr[i]);
            }
        }
        return retMe;
    };

    /**
     * TODO
     */
    var createBarColors = function( values ) {
        var barColors = new Array(values.length);
        for (var i=0; i < values.length; ++i) {
            if (values[i] < 0) {
                barColors[i] = "#b00";
                values[i] = values[i] * -1;
            } else {
                barColors[i] = "#0b0";
            }
        }
        return barColors;
    };

    /**
     * Set the bar colors of the given chart.
     */
    var setBarColors = function(theChart, barColors) {
        for (var i=0; i < barColors.length; ++i) {
            theChart.datasets[0].bars[i].fillColor = barColors[i];
        }
        theChart.update();
    };

    /**
     * Render the tran bar chart.
     */
    var renderTranChart = function( trans ) {
        Logger.info("AccountController.renderTranChart: ");

        if (trans.length == 0) {
            return;
        }

        // Get all date labels from earliest tran to today
        var fromTs = trans[ trans.length-1 ].timestamp * 1000;
        var fromDate = new Date( trans[ trans.length-1 ].timestamp * 1000);
        var labels = DateUtils.createDateLabels( fromDate );

        // Get values.
        var values = new Array(labels.length);
        for (var i=0; i < values.length; ++i) {
            values[i] = 0;
        }

        _.each( trans, 
                function(tran) {
                    var i = DateUtils.dateDiff( 'd', fromTs, tran.timestamp * 1000 );
                    values[i] += tran.amountValue ;
                } );

        Logger.fine("AccountController.renderTranChart: values=" + JSON.stringify(values));

        // Bar colors
        var barColors = createBarColors( values );

        // Setup data frame.
        var data = {
            labels: evenSample( labels, 10 ),
            datasets: [
                {
                    label: "My First dataset",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "rgba(220,220,220,1)",
                    highlightFill: "#fff",
                    highlightStroke: "rgba(220,220,220,1)",
                    data: values
                }
            ]
        };

        // Get the context of the canvas element we want to select
        var canvas = document.getElementById("tranChart").getContext("2d");
        var myTranChart = new Chart(canvas).Bar(data, {});

        setBarColors(myTranChart, barColors);

    };



    /**
     * @return the accountId from the query string.
     */
    var parseAccountIdFromLocation = function() {
        return $location.search().accountId || 0;
    }

    /**
     * Export to scope.
     */
    $scope.DateUtils = DateUtils;
    $scope.accountTrans = [];

    /**
     * Go!
     */
    Datastore.fetchAccount( parseAccountIdFromLocation() )
             .then( function success(account) { 
                        $scope.account = account; 
                        return account;
                    } )
             // Fetch account trans.
             .then( function success(account) {
                        var postData = { "query": { "account": account.accountName,
                                                    "fi": account.fiName,
                                                    "isResolved": { "$exists": false } },
                                         "options": { "sort": { "timestamp": -1 },
                                                      "limit": 50 } };
                        return Datastore.fetchTrans( postData );
                    })
             // Render trans chart.
             .then( function success(accountTrans) { 
                        $scope.accountTrans = accountTrans; 
                        renderTranChart( $scope.accountTrans);
                    });

    Datastore.fetchAccountTimeSeries( parseAccountIdFromLocation() )
             .then( function success(accountTimeSeries) { 
                        $scope.accountTimeSeries = accountTimeSeries;
                        renderValueChart( $scope.accountTimeSeries );
                    });

    Datastore.fetchTags()
             .then( function success(tags) { $scope.tags = tags; } ); 


}])


/**
 * Logger
 */
.factory("Logger", [ function() {

    var info = function(msg) {
        console.log(msg);
    }

    var fine = function(msg) {
        // console.log(msg);
    }

    var severe = function(msg) {
        alert(msg);
    }

    return {
        info: info,
        fine: fine,
        severe: severe
    };

}])


/**
 * Mongo datastore.
 */
.factory("Datastore", [ "$http", "Logger",
               function( $http,   Logger ) {

    /**
     * Fetch the list of tags from the db.
     *
     * @return promise, fulfilled with tags list
     */
    var fetchTags = function() {
        Logger.info("Datastore.fetchTags: ");
        return $http.get( "/tags" )
                    .then( function success(response) {
                               // response.data – {string|Object} – The response body transformed with the transform functions.
                               // response.status – {number} – HTTP status code of the response.
                               // response.headers – {function([headerName])} – Header getter function.
                               // resposne.config – {Object} – The configuration object that was used to generate the request.
                               // response.statusText – {string} – HTTP status text of the response.
                               Logger.fine( "Datastore.fetchTags: response=" + JSON.stringify(response,null,2));
                               return response.data ;
                           }, function error(response) {
                               Logger.severe("Datastore.fetchTags: GET /tags: response=" + JSON.stringify(response)); 
                           } );
    };

    /**
     * fetch account info from db
     *
     * @return promise, fulfilled by the account record.
     */
    var fetchAccount = function( accountId ) {
        Logger.info("Datastore.fetchAccount: accountId=" + accountId);

        // Promises:
        // $http.get returns a Promise.
        // A Promise object has a method on it called then(). 
        // then() takes two functions: a "success" callback and an "error" callback.
        // When the Promise is resolved, one or the other will be called.
        // the then() method returns another (chained) Promise.
        // The chaned Promise is resolved after the first Promise is resolved.
        // The value returned from the success callback becomes the "fulfillment value" for the chained Promise.
        return $http.get( "/accounts/" + accountId)
                    .then( function success(response) {
                               Logger.fine( "Datastore.fetchAccount: /accounts/" + accountId + ": response=" + JSON.stringify(response));
                               return response.data;
                           }, 
                           function error(response) {
                               Logger.severe("Datastore.fetchAccount: GET /account/" + accountId + ": response=" + JSON.stringify(response)); 
                           });
    };

    /**
     * @return promise, fulfilled by the accountTimeSeries records.
     */
    var fetchAccountTimeSeries = function( accountId ) {
        Logger.info("Datastore.fetchAccountTimeSeries: accountId=" + accountId);
        return $http.get( "/accounts/" + accountId + "/timeseries")
                    .then( function success(response) {
                               Logger.fine( "Datastore.fetchAccountTimeSeries: /accounts/" + accountId + "/timeseries: response=" + JSON.stringify(response));
                               return response.data;
                           }, 
                           function error(response) {
                               Logger.severe("Datastore.fetchAccountTimeSeries: GET /account/" + accountId + "/timeseries: response=" + JSON.stringify(response)); 
                           });
    };

    /**
     * @return promise, fulfilled by the account's tran records.
     */
    var fetchAccountTrans = function( accountId ) {
        Logger.info("Datastore.fetchAccountTrans: accountId=" + accountId);
        return $http.get( "/accounts/" + accountId + "/transactions")
                    .then( function success(response) {
                               Logger.info( "Datastore.fetchAccountTrans: /accounts/" + accountId + "/transactions: length=" + response.data.length );
                               Logger.fine( "Datastore.fetchAccountTrans: /accounts/" + accountId + "/transactions: response=" + JSON.stringify(response));
                               return response.data;
                           }, 
                           function error(response) {
                               Logger.severe("Datastore.fetchAccountTrans: GET /account/" + accountId + "/transactions: response=" + JSON.stringify(response)); 
                           });
    };

    /**
     * fetch accounts from db 
     *
     * @return promise
     */
    var fetchAccounts = function() {
        Logger.info("Datastore.fetchAccounts:");
        return $http.get( "/accounts" )
                    .then( function success(response) {
                               Logger.fine( "Datastore.fetchAccounts: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               Logger.severe("Datastore.fetchAccounts: GET /accounts: response=" + JSON.stringify(response)); 
                           } );
    };

    /**
     * fetch accounts with isActive=true from db 
     *
     * @return promise
     */
    var fetchActiveAccounts = function() {
        Logger.info("Datastore.fetchActiveAccounts:");
        var postData = { "query": { "isActive": true } };

        return $http.post( "/query/accounts", postData )
                    .then( function success(response) {
                               Logger.fine( "Datastore.fetchActiveAccounts: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               Logger.severe("Datastore.fetchActiveAccounts: POST /query/accounts: response=" + JSON.stringify(response)); 
                           } );
    };
    
    /**
     * fetch new (i.e. hasBeenAcked=false) trans from the db 
     *
     * @return promise
     */
    var fetchNewTrans = function() {
        Logger.info("Datastore.fetchNewTrans:");
        var postData = { "query": { "$or": [ { "hasBeenAcked": { "$exists": false } }, { "hasBeenAcked" : false } ] },
                         "options": { "sort": { "timestamp": -1 } } 
                       };
        return fetchTrans( postData );
    };

    /**
     * fetch trans
     *
     * @return promise
     */
    var fetchTrans = function( postData ) {
        Logger.info("Datastore.fetchTrans: postData=" + JSON.stringify(postData) );
        return $http.post( "/query/transactions", postData )
                    .then( function success(response) {
                               Logger.fine( "Datastore.fetchTrans: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               Logger.severe("Datastore.fetchTrans: POST /query/transactions: response=" + JSON.stringify(response));
                           } );
    };


    /**
     * PUT /transactions/{tranId}
     * {putData}
     *
     * @return promise
     */
    var putTran = function(tranId, putData) {

        Logger.info("Datastore.putTran: tranId=" + tranId + ", putData=" + JSON.stringify(putData));

        return $http.put( "/transactions/" + tranId, putData )
                    .then( function success(response) {
                               Logger.fine( "Datastore.putTran: response=" + JSON.stringify(response,null,2));
                           }, function error(response) {
                               Logger.severe("Datastore.putTran: PUT /transactions/" + tranId + ": response=" + JSON.stringify(response)); 
                           } );
    };


    return {
        fetchTags: fetchTags,
        fetchAccount: fetchAccount,
        fetchAccountTrans: fetchAccountTrans,
        fetchAccountTimeSeries: fetchAccountTimeSeries,
        fetchAccounts: fetchAccounts,
        fetchActiveAccounts: fetchActiveAccounts,
        fetchNewTrans: fetchNewTrans,
        fetchTrans: fetchTrans,
        putTran: putTran
    };

}])


/**
 * Date utils
 */
.factory( "DateUtils", [ "Logger", "dateFilter",
                 function(Logger,   dateFilter ) {

    /**
     * @param timestamp
     * @return formatted date string
     */
    var formatEpochAsDate = function( timestamp_ms ) {
        var date = new Date(timestamp_ms);
        var mon = "0" + (date.getMonth() + 1);
        var day = "0" + (date.getDate());
        var year = date.getYear() % 100;
        // var hours = date.getHours();
        // var minutes = "0" + date.getMinutes();
        // var seconds = "0" + date.getSeconds();
        return mon.substr(-2) + "/" + day.substr(-2) + "/" + year ; // + " " + hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);

    };
    
    var formatDateLabel = function( d ) {
        return dateFilter(d, "M/d/yy");
        // return d.toLocaleFormat('%m.%d.%y');
    };

    /**
     * @param datepart 'y', 'w', 'd', 'h', 'm', 's'
     */
    var dateDiff = function(datepart, fromdate, todate) {	
        datepart = datepart.toLowerCase();	
        var diff = todate - fromdate;	
        var divideBy = { w:604800000, 
                         d:86400000, 
                         h:3600000, 
                         m:60000, 
                         s:1000 };	
        return Math.floor( diff/divideBy[datepart]);
    };

    /**
     * @param timestamp_s
     */
    var createDateLabels_s = function( timestamp_s ) {
        return createDateLabels( new Date(timestamp_s * 1000) );
    }

    /**
     * @param fromDate
     * @return an array of date labels between fromDate and today
     */
    var createDateLabels = function( fromDate ) {

        var today = new Date();
        var daysBetween = dateDiff('d', fromDate, today);

        Logger.info("DateUtils.createDateLabels: fromDate=" + formatDateLabel(fromDate) 
                                            + ", today=" + formatDateLabel(today) 
                                            + ", daysBetween=" + daysBetween );

        var retMe = new Array(daysBetween);

        for (var i=0; i < daysBetween; ++i) {
            retMe[i] = formatDateLabel( fromDate );
            fromDate.setDate( fromDate.getDate() + 1);
        }

        Logger.fine("DateUtils.createDateLabels: retMe=" + JSON.stringify(retMe));
        return retMe;

    };

    return {
        createDateLabels: createDateLabels,
        formatEpochAsDate: formatEpochAsDate,
        dateDiff: dateDiff
    };
}])


/**
 * Copied from: http://stackoverflow.com/questions/25678560/angular-passing-scope-to-ng-include
 * For passing objects into the ng-include scope.
 *
 * Example:
 * <div ng-include-template="'template.html'" ng-include-variables="{ item: 'whatever' }"></div>
 */
.directive('ngIncludeTemplate', [ function() {  
  return {  
    templateUrl: function(elem, attrs) { return attrs.ngIncludeTemplate; },  
    restrict: 'A',  
    scope: {  
      'ngIncludeVariables': '&'  
    },  
    link: function(scope, elem, attrs) {  
      var vars = scope.ngIncludeVariables();  
      console.log("ngIncludeTemplate: vars=" + JSON.stringify(vars));
      Object.keys(vars).forEach(function(key) {  
        scope[key] = vars[key];  
      });  
    }  
  }  
}])

/**
 * underscore.js support.
 */
.factory('_', function() {
    return window._; // assumes underscore has already been loaded on the page
});

