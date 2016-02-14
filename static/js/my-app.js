angular.module( "MyApp",  ['puElasticInput'] )

.controller( "MainController",   ["$scope", "$http", "_",
                         function( $scope,   $http,   _ ) {

    console.log("MainController: alive!");

    /**
     * fetch new (i.e. hasBeenAcked=false) trans from the db and
     * put them in $scope.newTrans
     *
     * @sideeffect $scope.newTrans - populated from db
     */
    var fetchNewTrans = function() {

        var postData = { "query": { "$or": [ { "hasBeenAcked": { "$exists": false } }, { "hasBeenAcked" : false } ] },
                         "options": { "sort": { "timestamp": -1 } } 
                       };
        $http.post( "/query/transactions", postData )
             .then( function success(response) {
                 console.log( "fetchNewTrans: response=" + JSON.stringify(response,null,2));
                 $scope.newTrans = response.data;
             }, function error(response) {
                 alert("POST /query/transactions: response=" + JSON.stringify(response)); // TODO: dev
             } );
    };

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
     * fetch accounts from db and put them in $scope.accounts
     *
     * @sideeffect $scope.accounts - populated from db
     */
    var fetchAccounts = function() {
        $http.get( "/accounts" )
             .then( function success(response) {
                 // response.data – {string|Object} – The response body transformed with the transform functions.
                 // response.status – {number} – HTTP status code of the response.
                 // response.headers – {function([headerName])} – Header getter function.
                 // resposne.config – {Object} – The configuration object that was used to generate the request.
                 // response.statusText – {string} – HTTP status text of the response.
                 console.log( "fetchAccounts: response=" + JSON.stringify(response,null,2));
                 setAccounts( response.data );
             }, function error(response) {
                 alert("GET /accounts: response=" + JSON.stringify(response)); // TODO: dev
             } );
    };

    /**
     * fetch accounts with isActive=true from db and put them in $scope.accounts
     *
     * @sideeffect $scope.accounts - populated from db
     */
    var fetchActiveAccounts = function() {
        var postData = { "query": { "isActive": true } };

        $http.post( "/query/accounts", postData )
             .then( function success(response) {
                 console.log( "MainController.fetchActiveAccounts: response=" + JSON.stringify(response,null,2));
                 setAccounts( response.data );
             }, function error(response) {
                 alert("POST /query/accounts: response=" + JSON.stringify(response)); // TODO: dev
             } );
    };

    /**
     * Set hasBeenAcked=true for the given tran in the db.
     */
    var ackNewTran = function(tranId) {

        console.log("MainController.ackNewTran: " + tranId);

        // remove it from the list locally (faster)
        $scope.newTrans = _.filter( $scope.newTrans, function(tran) { return tran._id != tranId } );

        // update the db.
        var putData = { "hasBeenAcked": true } ;
        $http.put( "/transactions/" + tranId, putData )
             .then( function success(response) {
                 console.log( "MainController.ackNewTran: response=" + JSON.stringify(response,null,2));
             }, function error(response) {
                 alert("PUT /transactions/" + tranId + ": response=" + JSON.stringify(response)); // TODO: dev
             } );
    };

    /**
     * Fetch the list of tags from the db.
     */
    var fetchTags = function() {
        $http.get( "/tags" )
             .then( function success(response) {
                 // response.data – {string|Object} – The response body transformed with the transform functions.
                 // response.status – {number} – HTTP status code of the response.
                 // response.headers – {function([headerName])} – Header getter function.
                 // resposne.config – {Object} – The configuration object that was used to generate the request.
                 // response.statusText – {string} – HTTP status text of the response.
                 console.log( "MainController.fetchTags: response=" + JSON.stringify(response,null,2));
                 $scope.tags = response.data ;
             }, function error(response) {
                 alert("GET /tags: response=" + JSON.stringify(response)); // TODO: dev
             } );
    };

    /**
     * Listens for $addTranTag events.
     */
    var onAddTranTag = function(theEvent, tag) {
        console.log("MainController.onAddTranTag: tag=" + tag + ", $scope.tags=" + JSON.stringify($scope.tags));

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
        // console.log("MainController.sumField: fieldName=" + fieldName + ": " + retMe);
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
    $scope.formatEpochAsDate = formatEpochAsDate;
    $scope.getNetWorth = getNetWorth;
    $scope.getNetWorthPerf = getNetWorthPerf;
    $scope.sumField = sumField;

    $scope.$on("$addTranTag", onAddTranTag );

    /**
     * Init data
     */
    fetchActiveAccounts();
    fetchNewTrans();
    fetchTags();

}])


/**
 * ng-controller for tran tagging <form>(s).
 * There's one of these controllers for each tran ($scope.tran).
 */
.controller( "TagFormController",   ["$scope", "$http", "_", "$rootScope",
                            function( $scope,   $http,   _ ,  $rootScope) {

    console.log("TagFormController: alive!: $scope.tran=" + $scope.tran.amount);

    // -rx- /**
    // -rx-  * Called whenever the tag input field changes
    // -rx-  */
    // -rx- var onChangeInputTag = function() {
    // -rx-     // -rx- if ( $scope.inputTag.length >= 2 ) {
    // -rx-     // -rx-     // Filter for auto-complete list
    // -rx-     // -rx-     $scope.filteredTags = _.filter( $scope.tags, function(tag) { return tag.startsWith( $scope.inputTag ); } );
    // -rx-     // -rx-     console.log("TagFormController.onChangeInputTag: " + $scope.inputTag + "; filteredTags=" + JSON.stringify($scope.filteredTags) );

    // -rx-     // -rx-     if ($scope.filteredTags.length > 0) {
    // -rx-     // -rx-         var typedTextLen = $scope.inputTag.length;
    // -rx-     // -rx-         // $scope.inputTag = $scope.filteredTags[0];

    // -rx-     // -rx-         console.log( "TagFormController.onChangeInputTag: typedTextLen=" + typedTextLen + ", $scope.inputTag=" + $scope.inputTag );
    // -rx-     // -rx-         // var inputElem = angular.element( document.querySelector("#input-tag-" + $scope.tran._id) );
    // -rx-     // -rx-         var inputElem = document.getElementById("input-tag-" + $scope.tran._id );
    // -rx-     // -rx-         inputElem.value = $scope.filteredTags[0];
    // -rx-     // -rx-         inputElem.setSelectionRange( typedTextLen , $scope.filteredTags[0].length );
    // -rx-     // -rx-     }

    // -rx-     // -rx- } else {
    // -rx-     // -rx-     // TODO: when backspacing down to len=1, the list doesn't disappear.
    // -rx-     // -rx-     //       i think i might need to use $digest or something
    // -rx-     // -rx-     $scope.filteredTags = [];
    // -rx-     // -rx- }


    // -rx- };

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
        console.log("TagFormController.putTranTags: " + JSON.stringify($scope.tran.tags));
        var putData = { "tags": $scope.tran.tags } ;
        $http.put( "/transactions/" + $scope.tran._id, putData )
             .then( function success(response) {
                 console.log( "TagFormController.putTranTags: response=" + JSON.stringify(response,null,2));
             }, function error(response) {
                 alert("PUT /transactions/" + $scope.tran._id + ": response=" + JSON.stringify(response)); // TODO: dev
             } );
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
            console.log("TagFormController.addTranTag: $rootScope.$broadcast(event=$addTranTag, tag=" + tag + ")");
            $rootScope.$broadcast("$addTranTag", tag);
        }
    }

    /**
     * Called when the user hits 'enter' after typing in a tag.
     * Add the tag to the tran.
     */
    var onFormSubmit = function() {
        console.log("TagFormController.onFormSubmit: " + $scope.inputTag);
        addTranTag( $scope.inputTag )
    }

    // -rx- /**
    // -rx-  * Called when a filteredTag from the auto-complete list is clicked.
    // -rx-  */
    // -rx- var onClickFilteredTag = function(filteredTag) {
    // -rx-     console.log("TagFormController.onClickFilteredTag: " + filteredTag );
    // -rx-     addTranTag(filteredTag);
    // -rx-     
    // -rx-     // TODO: should use angular directive?
    // -rx-     var inputElem = angular.element( document.querySelector("#input-tag-" + $scope.tran._id) );
    // -rx-     console.log("TagFormController.onClickFilteredTag: inputElem=" + inputElem);
    // -rx-     inputElem[0].focus();
    // -rx- }

    /**
     * Remove the tag from the tran.
     */
    var removeTag = function(tag) {

        // remove it from the tags list 
        $scope.tran.tags = _.filter( $scope.tran.tags, function(t) { return t != tag; } );
        console.log("TagFormController.removeTag: " + tag + ", $scope.tran.tags=" + JSON.stringify($scope.tran.tags) );

        // Update the db
        putTranTags();
    };

    /**
     * Export to scope.
     */
    // -rx- $scope.onChangeInputTag = onChangeInputTag;
    $scope.onFormSubmit = onFormSubmit;
    // -rx- $scope.onClickFilteredTag = onClickFilteredTag;
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
.directive('tmAutoFill', [ "_", "$parse", function(_, $parse) {
    var directiveDefiningObj = {
        require: "ngModel",
        link: function($scope, element, attrs, ngModel) {

                  var fillStringList = $parse(attrs.tmAutoFill)($scope);
                  console.log("directive::tmAutoFill.link: fillStringList=" + JSON.stringify(fillStringList));

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
                      console.log("directive::tmAutoFill.oninput: "
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
                      console.log("directive::tnWatchInput.keydown: $scope.inputTag=" + $scope.inputTag 
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
.controller( "AccountController",   ["$scope", "$http", "_",
                            function( $scope,   $http,   _ ) {

    console.log("AccountController: alive!");

    // Get the context of the canvas element we want to select
    var ctx = document.getElementById("myChart").getContext("2d");

    /**
     *
     */
    var renderChart = function( accountTimeSeries ) {
        console.log("AccountController.renderChart: ");

        labels = _.pluck( accountTimeSeries, "date");
        var i=0;
        var nth = Math.round( labels.length / 10 );
        console.log("AccountController.renderChart: nth=" + nth + ", labels.length=" + labels.length);
        labels = _.map( labels, function(label) { return ( i++ % nth == 0 ) ? label : "" ; } );

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
     * fetch account info from db
     *
     * @sideeffect $scope.accounts - populated from db
     */
    var fetchAccount = function( accountId ) {
        $http.get( "/accounts/" + accountId)
             .then( function success(response) {
                        console.log( "fetchAccount: /accounts/" + accountId + ": response=" + JSON.stringify(response));
                        $scope.account = response.data;
                    }, 
                    function error(response) {
                        alert("GET /account/" + accountId + ": response=" + JSON.stringify(response)); // TODO: dev
                    });

        $http.get( "/accounts/" + accountId + "/timeseries")
             .then( function success(response) {
                        console.log( "fetchAccount: /accounts/" + accountId + "/timeseries: response=" + JSON.stringify(response));
                        $scope.accountTimeSeries = response.data;
                        renderChart( $scope.accountTimeSeries );
                    }, 
                    function error(response) {
                        alert("GET /account/" + accountId + "/timeseries: response=" + JSON.stringify(response)); // TODO: dev
                    });

        $http.get( "/accounts/" + accountId + "/transactions")
             .then( function success(response) {
                        // -rx- console.log( "fetchAccount: /accounts/" + accountId + "/transactions: response=" + JSON.stringify(response));
                        $scope.accountTrans = response.data;
                    }, 
                    function error(response) {
                        alert("GET /account/" + accountId + "/transactions: response=" + JSON.stringify(response)); // TODO: dev
                    });
    };


    /**
     * Go!
     */
    fetchAccount( 2759791 );

}])



/**
 * underscore.js support.
 */
.factory('_', function() {
    return window._; // assumes underscore has already been loaded on the page
});

