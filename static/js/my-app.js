angular.module( "MyApp",  ['puElasticInput', 'ngMaterial'] )

/**
 * TODO: separate controllers for subsets of accounts? then the summation html could be ng-included.
 *
 */
.controller( "AccountSummaryController",   ["$scope", "_", "Logger", "DateUtils", "Datastore", "MiscUtils",
                                   function( $scope,   _,   Logger,   DateUtils,   Datastore,   MiscUtils ) {

    Logger.info("AccountSummaryController: alive!");

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
        setAccountSums($scope.bankAndCreditAccountsSums, $scope.bankAndCreditAccounts);

        $scope.investmentAccounts = _.filter( $scope.accounts, 
                                                 function(account) { 
                                                     return ! (account.accountType == "credit" || account.accountType == "bank");
                                                 } );
        setAccountSums($scope.investmentAccountsSums, $scope.investmentAccounts);
    };

    /**
     * TODO
     */
    var setAccountSums = function( sums, accounts ) {
        // Set sum totals.
        _.each( ["value", "last7days", "last30days", "last90days", "last365days" ],
                function(fieldName) {
                    sums[fieldName] = sumField( accounts, fieldName );
                } );
    };

    /**
     * @return net worth (sum of value for all $scope.accounts)
     */
    var sumField = function(accounts, fieldName) {
        return MiscUtils.sumField(accounts, fieldName);
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
    $scope.bankAndCreditAccountsSums = {};
    $scope.investmentAccounts = {};
    $scope.investmentAccountsSums = {};
    $scope.DateUtils = DateUtils;
    $scope.getNetWorth = getNetWorth;
    $scope.getNetWorthPerf = getNetWorthPerf;
    $scope.sumField = sumField;

    /**
     * Init data
     */
    Datastore.fetchActiveAccounts().then( setAccounts );

}])


/**
 * NewTransController
 */
.controller( "NewTransController",   ["$scope", "_", "Logger", "Datastore", "MiscUtils",
                             function( $scope,   _,   Logger,   Datastore,   MiscUtils ) {

    Logger.info("NewTransController: alive!");

    /**
     * Called when a tran is ACKed.   Remove the tran from the list.
     */
    var onAckTran = function(theEvent, tranId) {

        Logger.info("NewTransController.onAckTran: tranId=" + tranId);

        // remove it from the list locally (faster)
        $scope.newTrans = _.filter( $scope.newTrans, function(tran) { return tran._id != tranId } );
    };

    /**
     * Listens for $addTranTag events.
     */
    var onAddTranTag = function(theEvent, tag) {
        Logger.info("NewTransController.onAddTranTag: tag=" + tag + ", $scope.tags=" + JSON.stringify($scope.tags));

        if ( ! _.contains($scope.tags, tag) ) {
            $scope.tags.push(tag);
        }
    };

    /**
     * Export to $scope
     */
    $scope.newTrans = [];
    $scope.sumField = MiscUtils.sumField;

    $scope.$on("$addTranTag", onAddTranTag );
    $scope.$on("$ackTran", onAckTran);

    $scope.thinking = true;

    /**
     * Init data
     */
    Datastore.fetchNewTrans()
             .then( function success(newTrans) { 
                        $scope.thinking = false;
                        $scope.newTrans = newTrans; 
                    } ); 

    // Populate tags for auto-fill.
    Datastore.fetchTags()
             .then( function success(tags) { $scope.tags = tags; } ); 

}])



/**
 * ng-controller for tran tagging <form>(s).
 * There's one of these controllers for each tran ($scope.tran).
 */
.controller( "TagFormController",   ["$scope", "_", "$rootScope", "Logger", "Datastore", "MiscUtils",
                            function( $scope,   _ ,  $rootScope,   Logger,   Datastore,   MiscUtils) {

    Logger.fine("TagFormController: alive!: $scope.tran=" + $scope.tran.amount);

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
        // -rx- $scope.filteredTags = [];   
        $scope.inputTag = "";

        tag = (tag || "").trim();

        if (MiscUtils.isEmpty(tag)) {
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
    // -rx- $scope.filteredTags = [];

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

                  // -rx- var fillStringList = $parse(attrs.tmAutoFill)($scope);
                  Logger.info("tmAutoFill.link: entry");

                  /**
                   *
                   */
                  var fillAndSelect = function( element, fillText ) {
                        var typedTextLen = element.val().length;
                        element.val( fillText );
                        element[0].setSelectionRange( typedTextLen , fillText.length );
                  };

                  /**
                   *
                   */
                  var autofill = function(element) {
                      var fillStringList = $parse(attrs.tmAutoFill)($scope);

                      Logger.info("tmAutoFill.autofill: element.val()=" + element.val()
                                                      + ", fillStringList=" + JSON.stringify(fillStringList));

                      var fillStrings = _.filter( fillStringList, function(fillString) { return fillString.startsWith( element.val() ); } );

                      if (fillStrings.length > 0) {
                          fillAndSelect( element, fillStrings[0] );
                      }
                  };

                  /**
                   *
                   */
                  element.on("input", function(event) {
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
 * Controller for account.html.
 */
.controller( "AccountController",   ["$scope", "_", "$location", "Logger", "DateUtils", "Datastore", "ChartUtils", "MiscUtils",
                            function( $scope,   _ ,  $location,   Logger,   DateUtils,   Datastore,   ChartUtils,   MiscUtils) {

    Logger.info("AccountController: alive! $location.search=" + JSON.stringify($location.search()));

    /**
     * TODO: chart rendering shoudl be done in directive? (since it access the DOM)
     * Render the current balance chart.
     */
    var renderValueChart = function( accountTimeSeries ) {
        Logger.info("AccountController.renderValueChart: ");

        // Get all date labels from earliest tran to today
        var fromTs = accountTimeSeries[ 0 ].timestamp * 1000;
        var labels = DateUtils.createDateLabels( new Date(fromTs), new Date() );
        
        // Get values.
        var values = new Array(labels.length);

        _.each( accountTimeSeries, 
                function(tsEntry) {
                    var i = DateUtils.dateDiff( 'd', fromTs, tsEntry.timestamp * 1000 );
                    values[i] = tsEntry.currentBalance;
                } );

        // Fill in the null's by carrying forward the previous non-null value
        var lastNonNullValue = 0;
        for (var i=0; i < values.length; ++i) {
            if (values[i] == null) {
                values[i] = lastNonNullValue;
            } else {
                lastNonNullValue = values[i];
            }
        }

        // Sample the data if we have LOTS of it
        // We may have lots of dates (labels.length), but not a lot of actual data points (accountTimeSeries.length)
        // We don't want MORE than 100 data points (slows down the chart).
        // So if there's MORE than 100, divide by 100 (50?) to get the sampleRate (everyNth record is sampled)
        // If there's LESS than 100, then we want to sample exactly as many entries as there are.
        // So if there's 20 entries, we want to sample 20 values out of (values.length), evenly: sampleRate = (values.length / 20)
        // sampleRate = values.length / # of data points
        // values.length / sampleRate = # of data points
        // # of data points should never > 100
        
        // TODO: include the first and last datapoint in the sample (first is always included... last not always).

        var sampleRate = Math.ceil( values.length / Math.min( accountTimeSeries.length, 100 )  );

        Logger.info("AccountController.renderValueChart: sampleRate=" + sampleRate 
                                                    + ", values.length=" + values.length
                                                    + ", accountTimeSeries.length=" + accountTimeSeries.length);

        // Setup data frame.
        var data = {
            labels: ChartUtils.sampleEvenlyAndReplace( ChartUtils.sampleEveryNth(labels, sampleRate), 10, "" ),
            datasets: [
                {
                    label: "My First dataset",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "rgba(220,220,220,1)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    data: ChartUtils.sampleEveryNth(values, sampleRate)
                }
            ]
        };

        // Get the context of the canvas element we want to select
        var valueChartCanvas = document.getElementById("valueChart").getContext("2d");
        var myValueChart = new Chart(valueChartCanvas).Line(data, {});
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
             .then( function success(account) { 
                        $scope.account = account; 
                        return account;
                    } ) ;

    Datastore.fetchAccountTimeSeries( parseAccountIdFromLocation() )
             .then( function success(accountTimeSeries) { 
                        $scope.accountTimeSeries = accountTimeSeries;
                        renderValueChart( $scope.accountTimeSeries );
                    });

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
 * Controller for saving a query.
 * Drop-down box containing names of all queries.
 *
 * "Load" button (or just load it automatically when it's selected?)
 * "Save" button (with either "overwrite warning" or "recovery option")
 *
 */
.controller( "SaveQueryFormController", ["$scope", "_", "$location", "Logger", "$rootScope", "Datastore", "MiscUtils", 
                                function( $scope,   _ ,  $location,   Logger,   $rootScope,   Datastore,   MiscUtils) {

    Logger.info("SaveQueryFormController: Alive!");


    /**
     * Called when the form is submitted.
     * Add a new saved query to the database.
     */
    var saveQuery = function() {
       
        var newSavedQuery = { name: $scope.inputSavedQueryName, 
                              query: $scope.postData.query };
        
        Logger.info("SaveQueryFormController.saveQuery: $scope.inputSavedQueryName=" + $scope.inputSavedQueryName
                                                   + ", $scope.postData=" + JSON.stringify( $scope.postData ) 
                                                   + ", $scope.selectedSavedQuery=" + JSON.stringify($scope.selectedSavedQuery),
                                                   + ", newSavedQuery=" + JSON.stringify(newSavedQuery) );

        Datastore.saveQuery( newSavedQuery )
                 .then( function() {  
                            // first remove if it already exists.
                            $scope.savedQueries = _.filter( $scope.savedQueries, 
                                                            function(savedQuery) { 
                                                                return savedQuery.name != newSavedQuery.name; 
                                                            } );

                            // add it back (possibly with an updated query).
                            $scope.savedQueries.push( newSavedQuery );
                            setSavedQueries( $scope.savedQueries );
                        } );
    };

    /**
     * Set the savedQueries into scope and sort them by name.
     */
    var setSavedQueries = function(savedQueries) {
        $scope.savedQueries = _.sortBy( savedQueries, "name" );
        Logger.info("SaveQueryFormController.setSavedQueries: " + JSON.stringify( $scope.savedQueries ) );
    };

    /**
     * Broadcast $loadSavedQuery event, which will be heard by the
     * parent controller TranQueryController, which will reload the tran data
     * based on the selected query.
     */
    var onChangeSavedQuery = function() {
        Logger.info("SaveQueryFormController.onChangeSavedQuery: $scope.selectedSavedQuery=" + JSON.stringify($scope.selectedSavedQuery) );

        if ($scope.selectedSavedQuery != null) {
            $rootScope.$broadcast("$loadSavedQuery", $scope.selectedSavedQuery);
        }

    };

    /**
     * @return the set of savedQueries whose name begins with the searchText.
     */
    var getSavedQueries = function(searchText) {
        Logger.info("SaveQueryFormController.getSavedQueries: " + searchText );

        if ( !MiscUtils.isEmpty(searchText) ) {
            return _.filter( $scope.savedQueries, 
                             function( savedQuery ) {
                                 return savedQuery.name.toLowerCase().startsWith(searchText.toLowerCase());
                             } );
        } else {
            return $scope.savedQueries;
        }
    };

    /**
     * Export to scope.
     */
    $scope.saveQuery = saveQuery;
    $scope.savedQueries = [];

    $scope.onChangeSavedQuery = onChangeSavedQuery;
    $scope.getSavedQueries = getSavedQueries;

    Datastore.fetchSavedQueries()
             .then( setSavedQueries );

    // -rx- setSavedQueries( [ {   name: "My Bills",
    // -rx-                        query: {"$or":[{"tags":"bills"}],"isResolved":{"$exists":false}}
    // -rx-                    },
    // -rx-                    {   name: "Feb Budget",
    // -rx-                        query: {"timestamp":{"$gte":1453878000,"$lte":1456556400},"isResolved":{"$exists":false}}
    // -rx-                    }
    // -rx-                  ] );
    // -rx-                        
}])


/**
 * Controller for tran lists and queries.
 */
.controller( "TranQueryController", ["$scope", "_", "$location", "Logger", "DateUtils", "Datastore", "MiscUtils", "ChartUtils",
                            function( $scope,   _ ,  $location,   Logger,   DateUtils,   Datastore,   MiscUtils,   ChartUtils) {

    Logger.info("TranQueryController: alive! $location.search=" + JSON.stringify($location.search()));

    /**
     * Remember theTranChart so we can clear its data when the tran list is updated.
     */
    var theTranChart = null;

    /**
     * Render the tran bar chart.
     */
    var renderTranChart = function( trans ) {
        Logger.info("TranQueryController.renderTranChart: ");

        if (theTranChart != null) {
            Logger.info("TranQueryController.renderTranChart: clearing previous tran chart");
            theTranChart.destroy();
        }

        if (trans.length == 0) {
            return;
        }

        // Get all date labels from earliest tran (last element) to most recent tran (first element)
        var fromTs = trans[ trans.length-1 ].timestamp * 1000;
        var fromDate = new Date( trans[ trans.length-1 ].timestamp * 1000);
        var toTs = trans[0].timestamp * 1000;
        var toDate = new Date( toTs );
        var labels = DateUtils.createDateLabels( fromDate, toDate );

        // Get values.
        var values = new Array(labels.length);
        for (var i=0; i < values.length; ++i) {
            values[i] = 0;
        }

        // Aggregate tran amounts on a per-day basis
        _.each( trans, 
                function(tran) {
                    var i = DateUtils.dateDiff( 'd', fromTs, tran.timestamp * 1000 );
                    values[i] += tran.amountValue ;
                } );


        var barColors = ChartUtils.createBarColors( values );       // red and green bar colors
        values = _.map(values, function(val) { return Math.abs(val); } );   // absolute values

        Logger.fine("TranQueryController.renderTranChart: values=" + JSON.stringify(values));

        // Setup data frame.
        var data = {
            labels: ChartUtils.sampleEvenlyAndReplace( labels, 10, "" ),
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
        theTranChart = new Chart(canvas).Bar(data, {});

        ChartUtils.setBarColors(theTranChart, barColors);
    };


    /**
     * @return the accountId from the query string.
     */
    var parseAccountIdFromLocation = function() {
        return $location.search().accountId || 0;
    }

    /**
     * The "more" button ng-click.
     * Fetch the next page of trans.
     */
    var fetchNextPage = function() {
        Logger.fine("TranQueryController.fetchNextPage: $scope.page=" + $scope.page);
        $scope.page += 1;
        fetchTransByPage( $scope.postData, $scope.page, $scope.pageSize )
            .then( appendTrans )
            .then( renderTranChart );
    }

    /**
     * The "all" button ng-click.
     * Fetch all remaining trans .
     */
    var fetchAllRemainingTrans = function() {
        Logger.fine("TranQueryController.fetchAllRemainingTrans: $scope.page=" + $scope.page);
        $scope.page += 1;

        $scope.postData.options = buildOptionsForAllRemainingTrans( $scope.page, $scope.pageSize );

        fetchTrans( $scope.postData )
            .then( appendTrans )
            .then( renderTranChart );
    };

    /**
     * @return an options object to apply to a query that fetches
     *         all the remaining trans.
     */
    var buildOptionsForAllRemainingTrans = function( page, pageSize ) {
        return { "sort": { "timestamp": -1 },
                 "skip": page * pageSize
               } ;
    };

    /**
     * @return an options object to apply to a query that fetches
     *         the next page of trans
     */
    var buildOptionsForNextPageOfTrans = function( page, pageSize ) {
        return { "sort": { "timestamp": -1 },
                 "limit": pageSize,
                 "skip": page * pageSize
               } ;
    };

    /**
     * @return promise fulfilled with trans
     */
    var fetchTransByPage = function(postData, page, pageSize) {
        postData.options = buildOptionsForNextPageOfTrans( page, pageSize );
        return fetchTrans( postData );
    };

    /**
     * Callback after fetching trans from the db.
     *
     * @return  $scope.trans, after being appended by the given trans.
     */
    var appendTrans = function(trans) {

        $scope.thinking = false;

        Array.prototype.push.apply( $scope.trans, trans); 

        $scope.transSums["amountValue"] = MiscUtils.sumField( $scope.trans, "amountValue" );

        // Mark "areAllTransFetched" = true, which will hid the "more" button.
        if (trans.length < $scope.pageSize) {
            $scope.areAllTransFetched = true;
        }

        Logger.info("TranQueryController.appendTrans: areAllTransFetched=" + $scope.areAllTransFetched);
        return $scope.trans;
    };

    /**
     * @return promise, fullfilled with tran data.
     */
    var fetchTrans = function(postData) {
        $scope.thinking = true;
        return Datastore.fetchTrans( postData );
    };

    /**
     * Fetch the total number of trans for the account.
     */
    var fetchTransSummary = function(postData) {
        Datastore.fetchTransSummary( postData )
                 .then( function(transSummary) { 
                            $scope.transSummary = transSummary;
                        });
    };

    // -rx- /**
    // -rx-  * Fetch the total number of trans for the account.
    // -rx-  */
    // -rx- var fetchTransCount = function(postData) {
    // -rx-     Datastore.fetchTransCount( postData )
    // -rx-              .then( function(count) { 
    // -rx-                         $scope.transCount = count;
    // -rx-                     });
    // -rx- };


    /**
     * Reset the trans array and the page number.
     */
    var resetTranList = function() {

        $scope.trans = [];
        $scope.page = 0;
        $scope.areAllTransFetched = false;
    };

    /**
     * Called from the view.
     */
    var onQueryFormSubmit = function() {

        resetTranList();
        $scope.postData.query = buildQuery();

        reloadTrans();
    };

    /**
     * Fetch trans for the updated query.
     */
    var reloadTrans = function() {

        // -rx- fetchTransCount($scope.postData);
        fetchTransSummary($scope.postData);
        fetchTransByPage( $scope.postData, $scope.page, $scope.pageSize )
                 // Append trans to scope.
                 .then( appendTrans )
                 // Render trans chart.
                 .then( renderTranChart );
    };

    /**
     * Build a query object based on all form data.
     *
     * @sideeffect sets $scope.postData.query
     */
    var buildQuery = function() {

        var query = {};
        var dateQuery = buildDateQuery( $scope.startDate, $scope.endDate );
        var tagsQuery = buildTagsQuery( $scope.tagsFilter );

        if ( ! _.isEmpty( dateQuery ) && ! _.isEmpty( tagsQuery ) ) {
            query = { "$and": [ dateQuery, tagsQuery ] };
        } else if (  ! _.isEmpty( dateQuery ) ) {
            query = dateQuery;
        } else if (  ! _.isEmpty( tagsQuery ) ) {
            query = tagsQuery;
        }

        Logger.info("TranQueryController.buildQuery: query=" + JSON.stringify(query) );
        return query;
    };

    /**
     * TODO
     */
    var buildDateQuery = function(startDate, endDate) {
        var query = {};
        if (startDate != null) {
            query.timestamp = query.timestamp || {};
            query.timestamp["$gte"] = startDate.getTime() / 1000;
        }

        if (endDate != null) {
            query.timestamp = query.timestamp || {};
            query.timestamp["$lte"] = endDate.getTime() / 1000;
        }

        Logger.info("TranQueryController.buildDateQuery: query=" + JSON.stringify(query) );

        return query;
    };

    /**
     * @return a query object for the given tags.
     */
    var buildTagsQuery = function( tagsFilter ) {
        var query = {};
        if ( tagsFilter.length > 0 ) {
            query = { "$or": _.map( tagsFilter, function(tag) { return { "tags": tag }; } ) } ;
            // end up with something like:
            // { $or: [ { tags: "dining" }, {tags: "socializing"} ] }
        }

        Logger.info("TranQueryController.buildTagsQuery: query=" + JSON.stringify(query) );
        return query;
    };

    /**
     * @return query data for the given account
     */
    var buildQueryFromAccount = function( account ) {
        Logger.info("TranQueryController.buildQueryFromAccount: account=" + JSON.stringify(account));
        return {   "account": account.accountName,
                   "fi": account.fiName };
    };

    /**
     * We must be embedded in the account.html page.
     * Fetch the account trans.
     */
    var forAccountPage = function( accountId ) {
        Logger.info("TranQueryController.forAccountPage: accountId=" + accountId );
        Datastore.fetchAccount( accountId )
                 .then( function success(account) { 
                            $scope.postData.query = buildQueryFromAccount(account); 
                            reloadTrans();
                        });
                 // -rx-            fetchTransCount($scope.postData);
                 // -rx-            return fetchTransByPage( $scope.postData, $scope.page, $scope.pageSize );
                 // -rx-        } )
                 // -rx- // Append trans to scope.
                 // -rx- .then( appendTrans )
                 // -rx- // Render trans chart.
                 // -rx- .then( renderTranChart );
    };

    /**
     * When used in the trans.html page.
     */
    var forTransPage = function() {
        reloadTrans();
    };

    /**
     * Called when the user hits 'enter' after typing in a tag.
     * Add the tag to tagsFilter
     */
    var addTag = function() {
        Logger.info("TranQueryController.addTag: " + $scope.inputTagFilter);
        var tag = $scope.inputTagFilter;

        // Clear the input field.
        $scope.inputTagFilter = "";

        if (MiscUtils.isEmpty(tag)) {
            return;
        }

        if ( ! _.contains($scope.tagsFilter, tag) ) {
            $scope.tagsFilter.push(tag);
            Logger.info("TranQueryController.addTag: $scope.tagsFilter=" + JSON.stringify($scope.tagsFilter));
        }
    }

    /**
     * Remove the tag from the tagsFilter list
     */
    var removeTag = function(tag) {
        $scope.tagsFilter = _.filter( $scope.tagsFilter, function(t) { return t != tag; } );
        Logger.info("TranQueryController.removeTag: " + tag + ", $scope.tagsFilter=" + JSON.stringify($scope.tagsFilter) );
    };

    /**
     * Parse the dates from the saved query and set them into the $scope
     * which updates the view.
     *
     * @sideeffect sets $scope.startDate and/or $scope.endDate
     */
    var parseDatesFromSavedQuery = function(savedQuery) {
        
        // Makes assumptions about the structure of the query.
        // Must be kept in sync with buildQuery
        var timestampQuery = (angular.isDefined(savedQuery.query["$and"])) 
                                            ? savedQuery.query["$and"][0]["timestamp"]
                                            : savedQuery.query["timestamp"];

        Logger.info("TranQueryController.parseDatesFromSavedQuery: timestampQuery=" + JSON.stringify(timestampQuery));

        if ( angular.isUndefined( timestampQuery ) ) {
            $scope.startDate = null;
            $scope.endDate = null;
            return;
        }

        if ( angular.isDefined( timestampQuery["$gte"] ) ) {
            $scope.startDate = new Date( timestampQuery["$gte"] * 1000);
        } else {
            $scope.startDate = null;
        }

        if ( angular.isDefined( timestampQuery["$lte"] ) ) {
            $scope.endDate = new Date( timestampQuery["$lte"] * 1000);
        } else {
            $scope.endDate = null;
        }
    };

    /**
     * Parse the tags from the saved query and set them into the $scope
     * which updates the view.
     *
     * @sideeffect sets $scope.tagsFilter
     */
    var parseTagsFromSavedQuery = function(savedQuery) {
        
        var tagsQuery = (angular.isDefined(savedQuery.query["$and"])) 
                                            ? savedQuery.query["$and"][1]["$or"]
                                            : savedQuery.query["$or"];


        if ( angular.isUndefined( tagsQuery ) ) {
            $scope.tagsFilter = [];
            return;
        }
        
        $scope.tagsFilter = _.pluck( tagsQuery, "tags" );
        Logger.info("TranQueryController.parseTagsFromSavedQuery: tagsQuery=" + JSON.stringify(tagsQuery)
                                                            + ", $scope.tagsFilter=" + JSON.stringify($scope.tagsFilter) );
    };

    /**
     * Event hanlder for "$loadSavedQuery" event.
     *
     * @sideeffect update $scope.postData and reload trans.
     * @sideeffect form fields (tags, startDate, endDate) are set
     *
     */
    var onLoadSavedQuery = function(theEvent, savedQuery) {
        Logger.info("TranQueryController.onLoadSavedQuery: savedQuery=" + JSON.stringify(savedQuery));

        resetTranList();
        $scope.postData.query = savedQuery.query;

        parseDatesFromSavedQuery( savedQuery );
        parseTagsFromSavedQuery( savedQuery );

        reloadTrans();
    };

    $scope.$on("$loadSavedQuery", onLoadSavedQuery);

    /**
     * Export to scope.
     */
    $scope.addTag = addTag;
    $scope.removeTag = removeTag;
    $scope.tagsFilter = [];

    $scope.startDate = null;
    $scope.endDate = null;
    $scope.postData = {};

    /**
     * Init data
     */
    // -rx- $scope.transCount = "xx";
    $scope.trans = [];
    $scope.transSums = {};  
    $scope.transSummary = { "count": "xx", 
                            "amountValue": 0 
                          };

    // Technically these don't need to be put in $scope since they're not used by the view.
    $scope.page = 0;
    $scope.pageSize = 50;

    $scope.fetchNextPage = fetchNextPage;
    $scope.fetchAllRemainingTrans = fetchAllRemainingTrans;
    $scope.areAllTransFetched = false;
    $scope.onQueryFormSubmit = onQueryFormSubmit;

    $scope.thinking = true;

    if ( parseAccountIdFromLocation() != 0 ) {
        // We must be embedded in account.html.  Fetch account trans.
        forAccountPage( parseAccountIdFromLocation() );
    } else {
        forTransPage();
    }

    // Populate tags for auto-fill.
    Datastore.fetchTags()
             .then( function success(tags) { $scope.tags = tags; } ); 

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
     * We pretty much never want to get pending trans that have been resolved
     * to cleared trans.  (mint actually deletes pending trans once they've been cleared).
     */
    var setIsResolved = function(postData) {
        postData.query = postData.query || {};
        postData.query.isResolved = { "$exists": false } ;
        return postData;
    };

    /**
     * fetch trans
     *
     * @return promise
     */
    var fetchTrans = function( postData ) {
        postData = setIsResolved(postData);
        Logger.info("Datastore.fetchTrans: postData=" + JSON.stringify(postData) );
        return $http.post( "/query/transactions", postData )
                    .then( function success(response) {
                               Logger.fine( "Datastore.fetchTrans: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               Logger.severe("Datastore.fetchTrans: POST /query/transactions"
                                                                    + ", postData=" + JSON.stringify(postData) 
                                                                    + ", response=" + JSON.stringify(response));
                           } );
    };

    /**
     * fetch trans count
     *
     * @return promise fullfilled with the count
     */
    var fetchTransCount = function( postData ) {
        postData = setIsResolved(postData);
        Logger.info("Datastore.fetchTransCount: postData=" + JSON.stringify(postData) );
        return $http.post( "/query/transactions/count", postData )
                    .then( function success(response) {
                               Logger.fine( "Datastore.fetchTrans: response=" + JSON.stringify(response,null,2));
                               return response.data[0];
                           }, function error(response) {
                               Logger.severe("Datastore.fetchTrans: POST /query/transactions/count"
                                                                    + ", postData=" + JSON.stringify(postData) 
                                                                    + ", response=" + JSON.stringify(response));
                           } );
    };

    /**
     * fetch trans summary
     *
     * @return promise fullfilled with the summary
     */
    var fetchTransSummary = function( postData ) {
        postData = setIsResolved(postData);
        Logger.info("Datastore.fetchTransSummary: postData=" + JSON.stringify(postData) );
        return $http.post( "/query/transactions/summary", postData )
                    .then( function success(response) {
                               Logger.fine( "Datastore.fetchTransSummary: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               Logger.severe("Datastore.fetchTranSummary: POST /query/transactions/summary"
                                                                    + ", postData=" + JSON.stringify(postData) 
                                                                    + ", response=" + JSON.stringify(response));
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

    /**
     * GET /savedqueries
     *
     * @return promise
     */
    var fetchSavedQueries = function() {
        Logger.info("Datastore.fetchSavedQueries: ");

        return $http.get( "/savedqueries" )
                    .then( function success(response) {
                               Logger.fine( "Datastore.fetchSavedQueries: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               Logger.severe("Datastore.fetchSavedQueries: GET /savedqueries: response=" + JSON.stringify(response)); 
                           } );
    };

    /**
     * POST /savedqueries {savedQuery}
     * @return promise
     */
    var saveQuery = function(savedQuery) {
        Logger.info("Datastore.saveQuery: savedQuery=" + JSON.stringify(savedQuery) );
        return $http.post( "/savedqueries", savedQuery)
                    .then( function success(response) {
                               Logger.fine( "Datastore.saveQuery: response=" + JSON.stringify(response,null,2));
                           }, function error(response) {
                               Logger.severe("Datastore.saveQuery: POST /savedqueries: postData=" + JSON.stringify(savedQuery)
                                                                      + "response=" + JSON.stringify(response)); 
                           } );
    };

    /**
     * export
     */
    return {
        fetchTags: fetchTags,
        fetchAccount: fetchAccount,
        fetchAccountTrans: fetchAccountTrans,
        fetchAccountTimeSeries: fetchAccountTimeSeries,
        fetchAccounts: fetchAccounts,
        fetchActiveAccounts: fetchActiveAccounts,
        fetchNewTrans: fetchNewTrans,
        fetchSavedQueries: fetchSavedQueries,
        saveQuery: saveQuery,
        fetchTrans: fetchTrans,
        fetchTransCount: fetchTransCount,
        fetchTransSummary: fetchTransSummary,
        putTran: putTran
    };

}])


/**
 * TODO: put various stuff in here until better homes can be found.
 *       like an orphanage.  or Foster care.
 */
.factory( "MiscUtils", [ "Logger", 
                 function(Logger) {

    /**
     * @return the givn currency string convered to a number.
     */
    var currencyToNumber = function(currStr) {
        return Number(currStr.replace(/[^0-9\.]+/g,""));
    }

    /**
     * @return net worth (sum of value for all $scope.accounts)
     */
    var sumField = function(objs, fieldName) {
        var retMe = _.reduce(objs, 
                             function(memo, obj) { 
                                 return memo + obj[fieldName]
                             }, 
                             0);
        Logger.fine("MiscUtils.sumField: fieldName=" + fieldName + ": " + retMe);
        return retMe;
    };

    /**
     * @return true if the given string is null or empty
     */
    var isEmpty = function(s) {
        return angular.isUndefined(s) || !s || s.trim().length == 0;
    };

    return {
        currencyToNumber: currencyToNumber,
        sumField: sumField,
        isEmpty: isEmpty
    };
}])


/**
 * Chart utils.
 */
.factory( "ChartUtils", [ function() {

    /**
     * @return a new array, same size as the given array, with at most num elements
     *         sampled evenly (i.e. every (arr.length/num)'th element) from the given array.
     *         All other non-sampled values are replaced with replaceValue.
     */
    var sampleEvenlyAndReplace = function( arr, num, replaceValue ) {
        return sampleEveryNthAndReplace(arr, Math.ceil( arr.length / num ), replaceValue);
    };

    /**
     * @return a new array, same size as the given array, where everyNth element 
     *         is copied over from the given array to the returned array, and every
     *         other element in between is replaced with the given replaceValue 
     *         Note: the first element is always copied over.
     */
    var sampleEveryNthAndReplace = function( arr, everyNth, replaceValue) {
        var retMe = new Array(arr.length);
        for (var i=0; i < arr.length; ++i) {
            if (i % everyNth == 0) {
                retMe[i] = arr[i];
            } else {
                retMe[i] = replaceValue;
            }
        }
        return retMe;
    };

    /**
     * @return a new array containing everyNth element from the given array.
     *         Note: the first element is always included.
     */
    var sampleEveryNth = function( arr, everyNth) {
        var retMe = [];
        for (var i=0; i < arr.length; ++i) {
            if (i % everyNth == 0) {
                retMe.push(arr[i]);
            }
        }
        return retMe;
    };

    /**
     * @return an array of bar colors based on the given values.
     *         if value < 0, barcolor=red; else barcolor=green
     */
    var createBarColors = function( values ) {
        var barColors = new Array(values.length);
        for (var i=0; i < values.length; ++i) {
            if (values[i] < 0) {
                barColors[i] = "#b00";
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
     * Export
     */
    return {
        sampleEvenlyAndReplace: sampleEvenlyAndReplace,
        sampleEveryNthAndReplace: sampleEveryNthAndReplace,
        sampleEveryNth: sampleEveryNth,
        createBarColors: createBarColors,
        setBarColors: setBarColors
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
     * @return an array of date labels between fromDate and toDate
     */
    var createDateLabels = function( fromDate, toDate ) {

        // -rx- var today = new Date();
        var daysBetween = dateDiff('d', fromDate, toDate);

        Logger.info("DateUtils.createDateLabels: fromDate=" + formatDateLabel(fromDate) 
                                            + ", toDate=" + formatDateLabel(toDate) 
                                            + ", daysBetween=" + daysBetween );

        var retMe = new Array(daysBetween);

        for (var i=0; i <= daysBetween; ++i) {
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

