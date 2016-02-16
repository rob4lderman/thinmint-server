angular.module( "MyApp",  ['puElasticInput'] )

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
     * Set hasBeenAcked=true for the given tran in the db.
     */
    var ackNewTran = function(tranId) {

        Logger.info("MainController.ackNewTran: " + tranId);

        // remove it from the list locally (faster)
        $scope.newTrans = _.filter( $scope.newTrans, function(tran) { return tran._id != tranId } );

        // update the db.
        var putData = { "hasBeenAcked": true } ;
        Datastore.putTran( tranId, putData );
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
    $scope.ackNewTran = ackNewTran;
    $scope.DateUtils = DateUtils;
    $scope.getNetWorth = getNetWorth;
    $scope.getNetWorthPerf = getNetWorthPerf;
    $scope.sumField = sumField;

    $scope.$on("$addTranTag", onAddTranTag );

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
 *
 */
.controller( "AccountController",   ["$scope", "_", "$location", "Logger", "DateUtils", "Datastore",
                            function( $scope,   _ ,  $location,   Logger,   DateUtils,   Datastore) {

    Logger.info("AccountController: alive! $location.search=" + JSON.stringify($location.search()));

    // Get the context of the canvas element we want to select
    var ctx = document.getElementById("myChart").getContext("2d");

    /**
     *
     */
    var renderChart = function( accountTimeSeries ) {
        Logger.fine("AccountController.renderChart: ");

        // Too many labels!  Pick 10 of them.
        labels = _.pluck( accountTimeSeries, "date");
        var i=0;
        var nth = Math.round( labels.length / 10 );
        Logger.fine("AccountController.renderChart: nth=" + nth + ", labels.length=" + labels.length);
        labels = _.map( labels, function(label) { return ( i++ % nth == 0 ) ? label : "" ; } );
        // TODO: the x-axis is a time-series, but chart.js doesn't know that, so it's not properly spaced.
        //       maybe try google charts instead.

        values = _.pluck( accountTimeSeries, "currentBalance");

        var data = {
            labels: labels,
            datasets: [
                {
                    label: "My First dataset",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "rgba(220,220,220,1)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    data: values
                }
            ]
        };

        var myLineChart = new Chart(ctx).Line(data, {});
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

    /**
     * Go!
     */
    Datastore.fetchAccount( parseAccountIdFromLocation() )
             .then( function success(account) { $scope.account = account; } ); 

    Datastore.fetchAccountTimeSeries( parseAccountIdFromLocation() )
             .then( function success(accountTimeSeries) { 
                        $scope.accountTimeSeries = accountTimeSeries;
                        renderChart( $scope.accountTimeSeries );
                    });

    Datastore.fetchAccountTrans( parseAccountIdFromLocation() )
             .then( function success(accountTrans) { $scope.accountTrans = accountTrans; } ); 

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
        return $http.post( "/query/transactions", postData )
                    .then( function success(response) {
                               Logger.fine( "Datastore.fetchNewTrans: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               Logger.severe("Datastore.fetchNewTrans: POST /query/transactions: response=" + JSON.stringify(response));
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
        putTran: putTran
    };

}])


/**
 * Date utils
 */
.factory( "DateUtils", [ function() {

    /**
     * @return formatted date string
     */
    var formatEpochAsDate = function( timestamp ) {
        var date = new Date(timestamp);
        var mon = "0" + (date.getMonth() + 1);
        var day = "0" + (date.getDate());
        var year = date.getYear() % 100;
        // var hours = date.getHours();
        // var minutes = "0" + date.getMinutes();
        // var seconds = "0" + date.getSeconds();
        return mon.substr(-2) + "/" + day.substr(-2) + "/" + year ; // + " " + hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
    };

    return {
        formatEpochAsDate: formatEpochAsDate
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

