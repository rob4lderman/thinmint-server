
angular.module( "MyApp",  ['puElasticInput', 'ngMaterial', 'tmFactories' ] )

/**
 * Events:
 *
 * $tmLoadSavedQuery:
 *      Emitter: SaveQueryFormController.onChangeSavedQuery
 *      Emitter: TranPageController.onLoad
 *      Listener: SaveQueryFormController
 *      Listener: TranChartController
 *      Listener: TranQueryController
 *      Listener: TranListController
 *
 * $tmTranQueryUpdated
 *      Emitter: AccountsPageController.onLoad
 *      Emitter: TranPageController.onLoad
 *      Emitter: TranQueryController.onQueryFormSubmit
 *      Listener: TranChartController
 *      Listener: TranListController
 *
 * $tmAccountLoaded:
 *      Listener: TranChartController
 *      Listener: TranListController
 *
 * $tmAccountsLoaded
 *      Emitter: AccountsPageController.onLoad -> Datastore
 *      Listener: AccountListController
 *
 * $tmAccountIdSelected
 *      Emitter: AccountPageController
 *      Listener: SingleAccountSummaryController
 *      Listener: AccountTimeSeriesChartController
 *
 * $tmTagsByMonthLoaded
 *      Emitter: TagsPageController
 *      Listener: TagsByMonthChartController
 *
 * $tmAddTranTag
 *      Emitter: TagFormController
 *      Listener: NewTransController
 *      Listener: AccountPageController
 *      Listener: AccountsPageController
 *      Listener: TranPageController
 *      Listener: TagsPageController
 *
 * $tmAckTran
 *      Emitter: TranAckFormController
 *      Listener: NewTransController
 *
 */

/**
 * Note: could separate controllers for subsets of accounts? then the summation html could be ng-included.
 *       http://stackoverflow.com/questions/13811948/different-ng-includes-on-the-same-page-how-to-send-different-variables-to-each
 *
 *       use ng-if trick:
 *       http://stackoverflow.com/questions/25678560/angular-passing-scope-to-ng-include
 *
 */
.controller( "AccountSummaryController",   ["$scope", "_", "Logger", "DateUtils", "Datastore", "MiscUtils",
                                   function( $scope,   _,   Logger,   DateUtils,   Datastore,   MiscUtils ) {

    var logger = Logger.getLogger("AccountSummaryController");
    logger.info("AccountSummaryController: alive!");

    /**
     * Set $scope.accounts 
     * Set $scope.bankAndCreditAccounts
     */
    var setAccounts = function( accounts ) {
        $scope.isThinking = false;
        $scope.accounts = accounts;
        $scope.bankAndCreditAccounts = _.filter( $scope.accounts, 
                                                 function(account) { 
                                                     return account.accountType == "credit" || account.accountType == "bank";
                                                 } );

        $scope.bankAndCreditAccountsSums = MiscUtils.sumFields( $scope.bankAndCreditAccounts, 
                                                                ["value", "last7days", "last30days", "last90days", "last365days" ]);

        $scope.investmentAccounts = _.filter( $scope.accounts, 
                                                 function(account) { 
                                                     return ! (account.accountType == "credit" || account.accountType == "bank");
                                                 } );


        $scope.investmentAccountsSums = MiscUtils.sumFields( $scope.investmentAccounts, 
                                                             ["value", "last7days", "last30days", "last90days", "last365days" ]);

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
    $scope.MiscUtils = MiscUtils;
    $scope.getNetWorth = getNetWorth;
    $scope.getNetWorthPerf = getNetWorthPerf;
    $scope.sumField = sumField;

    $scope.isThinking = true;

    /**
     * Init data
     */
    Datastore.fetchActiveAccounts().then( setAccounts );

}])


/**
 * Controller for accounts.html
 */
.controller( "AccountsPageController",   ["$scope", "_", "Logger", "DateUtils", "Datastore", "MiscUtils", "$location",
                                 function( $scope,   _,   Logger,   DateUtils,   Datastore,   MiscUtils,   $location ) {

    var logger = Logger.getLogger("AccountsPageController", { all: false });
    logger.info("alive! $location.search=" + JSON.stringify($location.search()) );

    /**
     * @return the accountId from the query string.
     */
    var parseAccountTypesFromLocation = function() {
        var retMe = $location.search().accountTypes || "All";
        logger.fine("parseAccountTypesFromLocation: retMe=" + JSON.stringify(retMe));
        return retMe;
    };

    /**
     * @return the internal accountId that represents the given accountTypes group.
     */
    var getAccountIdForAccountTypes = function(accountTypes) {
        if ( $scope.accountTypes == "Cash" ) {
            return -2;
        } else if ( $scope.accountTypes == "Investment" ) {
            return -3;
        } else {
            return -1; // net worth (all accounts)
        }
    }

    /**
     * @return the appropriate accountType query based on the given accountTypes
     */
    var buildAccountsQueryForAccountTypes = function(accountTypes) {
        var query = { "isActive": true };

        if ( $scope.accountTypes == "Cash" ) {
            query.accountType = { "$in": [ "bank", "credit" ] };

        } else if ( $scope.accountTypes == "Investment" ) {
            query.accountType = { "$nin": [ "bank", "credit" ] };
        }

        return query;
    };

    /**
     * @return the appropriate accountType query based on the given accountTypes
     */
    var buildTranQueryForAccountTypes = function(accountTypes) {

        if ( $scope.accountTypes == "Cash" ) {
            return { txnType: 0 } ;

        } else if ( $scope.accountTypes == "Investment" ) {
            return { txnType: 1 } ;

        } else {
            return {};
        }
    };

    /**
     * Determine which accounts to retrieve based on query string.
     */
    var onLoad = function() {

        var options = { "sort": { "fiName": 1, "accountName": 1 },
                                  "fields": Datastore.getAccountFieldProjection() 
                      };

        $scope.accountTypes = parseAccountTypesFromLocation();

        var query = buildAccountsQueryForAccountTypes( $scope.accountTypes );

        logger.fine("onLoad: queryAccounts postData=" + JSON.stringify( { query: query, options: options } ));
        Datastore.queryAccounts( { query: query, options: options } )
                 .then( _.partial( MiscUtils.$broadcast, "$tmAccountsLoaded" ) );

        // Broadcast the $tmTranQueryUpdated event 
        // Note: even with the timeout this event is still being fired before
        //       other controllers have loaded (e.g. TranListController, which is
        //       loaded from a partial, so loaded in a different run cycle), so they
        //       don't see the event and therefore don't load the appropriate data.
        //       How to solve this? SO doesn't know.
        //       how about... keeping track of fired events somehow...
        //       when a new controller inits it can check the registry of fired events.
        //       so... MiscUtils.$broadcast would add "$tmTranQueryUpdated" to registry of events.
        //       new controller would check MiscUtils.firedEvents["$tmTranQueryUpdated"] and
        //       immediately fire the event (call the callback function) if the event has
        //       already fired.
        var tranQuery = buildTranQueryForAccountTypes( $scope.accountTypes );
        MiscUtils.$broadcast( "$tmTranQueryUpdated", tranQuery);

        // Broadcast, for the AccountTimeSeriesChartController.
        MiscUtils.$broadcast( "$tmAccountIdSelected", getAccountIdForAccountTypes( $scope.accountTypes ) );
    };

    /**
     * Listen for location changes
     * Note: the initial page load generates a $locationChangeSuccess event, which is
     *       how we load the initial data.
     */
    var onLocationChangeSuccess = function(theEvent, currentLocation, previousLocation) {
        logger.info("onLocationChangeSuccess: currentLocation=" + currentLocation
                                            + ", previousLocation=" + previousLocation );
        onLoad();
    };

    $scope.$on( "$locationChangeSuccess", onLocationChangeSuccess );

    // Populate tags for child controllers.
    Datastore.fetchTags()
             .then( function success(tags) { $scope.tags = tags; } ); 

    // Listens for $tmAddTranTag events
    MiscUtils.listenForAddTranTag($scope, logger);

}])

/**
 * Controller for account-list.html
 * Gets data from $tmAccountsLoaded event.
 */
.controller( "AccountListController",   ["$scope", "_", "Logger", "DateUtils", "Datastore", "MiscUtils", "$location",
                                function( $scope,   _,   Logger,   DateUtils,   Datastore,   MiscUtils,   $location ) {

    var logger = Logger.getLogger("AccountListController", { all: false });
    logger.info("AccountListController: alive!");

    /**
     * Set $scope.accounts 
     */
    var setAccounts = function( accounts ) {
        $scope.isThinking = false;
        $scope.accounts = accounts;
        $scope.accountsSums = MiscUtils.sumFields( $scope.accounts, 
                                                   ["value", "last7days", "last30days", "last90days", "last365days" ]);
    };

    /**
     * $tmAccountsLoaded event is emitted by Datastore.
     */
    var onAccountsLoaded = function(theEvent, accounts) {
        logger.fine("onAccountsLoaded: entry");
        setAccounts(accounts);
    };

    MiscUtils.$on( $scope, "$tmAccountsLoaded", onAccountsLoaded) ;

    /**
     * Listen for location changes
     * Note: the initial page load generates a $locationChangeSuccess event, which is
     *       how we load the initial data.
     */
    var onLocationChangeStart = function(theEvent, currentLocation, previousLocation) {
        logger.info("onLocationChangeStart: currentLocation=" + currentLocation
                                            + ", previousLocation=" + previousLocation );
        $scope.accounts = [];
        $scope.isThinking = true;
    };

    $scope.$on( "$locationChangeStart", onLocationChangeStart);


    /**
     * Export to $scope
     */
    $scope.accounts = [];
    $scope.accountsSums = {};
    $scope.DateUtils = DateUtils;
    $scope.MiscUtils = MiscUtils;

    $scope.isThinking = true;
}])



/**
 * NewTransController
 */
.controller( "NewTransController",   ["$scope", "_", "Logger", "Datastore", "MiscUtils",
                             function( $scope,   _,   Logger,   Datastore,   MiscUtils ) {

    var logger = Logger.getLogger("NewTransController", {all: false});
    logger.info("alive!");

    /**
     * Called when a tran is ACKed.   Remove the tran from the list.
     */
    var onAckTran = function(theEvent, tranId) {

        logger.info("onAckTran: tranId=" + tranId);

        // remove it from the list locally (faster)
        $scope.newTrans = _.filter( $scope.newTrans, function(tran) { return tran._id != tranId } );
    };


    /**
     * Export to $scope
     */
    $scope.newTrans = [];
    $scope.sumField = MiscUtils.sumField;
    $scope.MiscUtils = MiscUtils;

    $scope.$on("$tmAckTran", onAckTran);

    $scope.isThinking = true;

    /**
     * Init data
     */
    Datastore.fetchNewTrans()
             .then( function success(newTrans) { 
                        $scope.isThinking = false;
                        $scope.newTrans = newTrans; 
                    } ); 

    // Populate tags for auto-fill.
    Datastore.fetchTags()
             .then( function success(tags) { $scope.tags = tags; } ); 

    // Listens for $tmAddTranTag events
    MiscUtils.listenForAddTranTag($scope, logger);

}])

/**
 * ng-controller for tran tagging <form>(s).
 * There's one of these controllers for each tran ($scope.tran).
 */
.controller( "TagFormController",   ["$scope", "_", "$rootScope", "Logger", "Datastore", "MiscUtils",
                            function( $scope,   _ ,  $rootScope,   Logger,   Datastore,   MiscUtils) {

    var logger = Logger.getLogger( "TagFormController" );
    logger.fine("TagFormController: alive!: $scope.tran=" + $scope.tran.amount);

    /**
     * PUT the tag updates to the db.
     */
    var putTranTags = function() {
        logger.info("putTranTags: " + JSON.stringify($scope.tran.tags));
        var putData = { "tags": $scope.tran.tags } ;
        Datastore.putTran( $scope.tran._id, putData );
    };

    /**
     * add a tag to the tran
     */
    var addTranTag = function(tag) {

        // Clear the auto-complete list and the input field.
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
            logger.info("addTranTag: $rootScope.$broadcast(event=$tmAddTranTag, tag=" + tag + ")");
            $rootScope.$broadcast("$tmAddTranTag", tag);
        }
    }

    /**
     * Called when the user hits 'enter' after typing in a tag.
     * Add the tag to the tran.
     */
    var onFormSubmit = function() {
        logger.info("onFormSubmit: " + $scope.inputTag);
        addTranTag( $scope.inputTag )
    }

    /**
     * Remove the tag from the tran.
     */
    var removeTag = function(tag) {

        // remove it from the tags list 
        $scope.tran.tags = _.filter( $scope.tran.tags, function(t) { return t != tag; } );
        logger.info("removeTag: " + tag + ", $scope.tran.tags=" + JSON.stringify($scope.tran.tags) );

        // Update the db
        putTranTags();
    };

    /**
     * Export to scope.
     */
    $scope.onFormSubmit = onFormSubmit;
    $scope.removeTag = removeTag;

}])


/**
 * The ACK button
 */
.controller( "TranAckFormController",   ["$scope", "$rootScope", "Logger", "Datastore",
                                function( $scope,   $rootScope,   Logger,   Datastore ) {

    var logger = Logger.getLogger("TranAckFormController");
    logger.fine("TranAckFormController: alive!");

    /**
     * Set hasBeenAcked=true for the given tran in the db.
     */
    var ackTran = function(tranId) {

        logger.info("TranAckFormController.ackTran: tranId=" + tranId);

        // update the db.
        var putData = { "hasBeenAcked": true } ;
        Datastore.putTran( tranId, putData );

        logger.info("TranAckFormController.ackTran: $rootScope.$broadcast(event=$tmAckTran, tranId=" + tranId + ")");
        $rootScope.$broadcast("$tmAckTran", tranId);
    };

    /**
     * Export to scope
     */
    $scope.ackTran = ackTran;

}])


/**
 * Show summary table for just a single account.
 */
.controller( "SingleAccountSummaryController",   ["$scope", "_", "Logger", "DateUtils", "Datastore", "MiscUtils",
                                         function( $scope,   _,   Logger,   DateUtils,   Datastore,   MiscUtils) {

    var logger = Logger.getLogger("SingleAccountSummaryController", {all:false});
    logger.info("alive!");

    /**
     * @param account set into scope
     * @return account
     */
    var setAccount = function(account) { 
        $scope.account = account; 
        $scope.isThinking = false;
        return account;
    };

    /**
     * For detecting duplicate events.
     */
    var DupEventChecker = MiscUtils.getDupEventChecker( logger );

    /**
     * Fetch account data for the given accountid.
     * $tmAccountIdSelected event is emitted by AccountPageController
     */
    var onAccountIdSelected = function(theEvent, accountId) {
        logger.fine("onAccountIdSelected: accountId=" + accountId);

        // Check for dup event.
        if ( DupEventChecker.isDupEvent(accountId) ) {
            return;
        }

        $scope.isThinking = true;
        Datastore.fetchAccount( accountId )
                 .then( _.partial( MiscUtils.$broadcast, "$tmAccountLoaded" ) )
                 .then( setAccount );
    };

    MiscUtils.$on( $scope, "$tmAccountIdSelected", onAccountIdSelected ) ;

    /**
     * Export
     */
    $scope.isThinking = true;
    $scope.DateUtils = DateUtils;
    $scope.MiscUtils = MiscUtils;

}])


/**
 * For the account balance time series chart.
 *
 * Listens for $tmAccountIdSelected event.
 */
.controller( "AccountTimeSeriesChartController",   ["$scope", "_", "Logger", "DateUtils", "Datastore", "ChartUtils", "MiscUtils", 
                                           function( $scope,   _ ,  Logger,   DateUtils,   Datastore,   ChartUtils,   MiscUtils ) {

    var logger = Logger.getLogger("AccountTimeSeriesChartController", {info:false});
    logger.info("alive!");

    /**
     * Render the current balance chart.
     */
    var renderChart = function( accountTimeSeries ) {
        logger.fine("renderChart: entry");

        if (accountTimeSeries.length == 0) {
            $scope.chartData = {};
            return;
        }

        // Get all date labels from earliest tran to today
        var fromTs = accountTimeSeries[ 0 ].timestamp * 1000;
        var toTs = accountTimeSeries[ accountTimeSeries.length - 1].timestamp * 1000;

        var labels = DateUtils.createDateLabels( new Date(fromTs), new Date(toTs) );
        
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
        
        var sampleRate = Math.ceil( values.length / Math.min( accountTimeSeries.length, 100 )  );

        logger.fine("renderChart: sampleRate=" + sampleRate 
                               + ", values.length=" + values.length
                               + ", accountTimeSeries.length=" + accountTimeSeries.length);

        // Setup data frame.
        $scope.chartData = {
            tm: { type: "Line" },
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
    };

    /**
     * @param accountTimeSeries set into scope
     * @return accountTimeSeries
     */
    var setAccountTimeSeries = function(accountTimeSeries) {
        $scope.accountTimeSeries = accountTimeSeries;
        $scope.isChartThinking = false;
        $scope.chartTitle = (accountTimeSeries.length > 0) ? accountTimeSeries[0].accountName : "Account Balance";
        return accountTimeSeries;
    };

    /**
     * For detecting duplicate events.
     */
    var DupEventChecker = MiscUtils.getDupEventChecker( logger );

    /**
     * Fetch timeseries data for the given accountId
     * $tmAccountIdSelected emitted by AccountPageController and AccountsPageController.
     */
    var onAccountIdSelected = function(theEvent, accountId) {
        logger.info("onAccountIdSelected: accountId=" + accountId);

        // Check for dup event.
        if ( DupEventChecker.isDupEvent(accountId) ) {
            return;
        }

        $scope.isChartThinking = true;
        Datastore.fetchAccountTimeSeries( accountId )
             .then( setAccountTimeSeries ) 
             .then( renderChart );
    };

    MiscUtils.$on( $scope, "$tmAccountIdSelected", onAccountIdSelected ) ;

    /**
     * Init and export.
     */
    $scope.isChartThinking = true;
    $scope.chartData = {};


}])

/**
 * Controller for account.html.
 */
.controller( "AccountPageController", ["$scope", "$location", "Logger", "$timeout", "Datastore", "MiscUtils", 
                              function( $scope,   $location,   Logger,   $timeout,   Datastore,   MiscUtils) {

    var logger = Logger.getLogger("AccountPageController", {all:false});

    logger.info("alive! $location.search=" + JSON.stringify($location.search()));

    /**
     * @return the accountId from the query string.
     */
    var parseAccountIdFromLocation = function() {
        return $location.search().accountId || 0;
    }

    MiscUtils.$broadcast( "$tmAccountIdSelected", parseAccountIdFromLocation() );

    // Populate tags for auto-fill.
    Datastore.fetchTags()
             .then( function success(tags) { $scope.tags = tags; } ); 

    // Listens for $tmAddTranTag events
    MiscUtils.listenForAddTranTag($scope, logger);

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

    var logger = Logger.getLogger("SaveQueryFormController", {all:false});
    logger.info("Alive!");


    /**
     * Called when the form is submitted.
     * Add a new saved query to the database.
     */
    var saveQuery = function() {
       
        var newSavedQuery = { name: $scope.inputSavedQueryName, 
                              query: $scope.postData.query };
        
        logger.fine("saveQuery: $scope.inputSavedQueryName=" + $scope.inputSavedQueryName
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

                            alert( "Current filter saved as '" + newSavedQuery.name + "'");
                        } );
    };

    /**
     * Set the savedQueries into scope and sort them by name.
     */
    var setSavedQueries = function(savedQueries) {
        $scope.savedQueries = _.sortBy( savedQueries, "name" );
        logger.fine("setSavedQueries: " + JSON.stringify( $scope.savedQueries ) );
    };

    /**
     * Broadcast $tmLoadSavedQuery event, which will be heard by the
     * parent controller TranQueryController, which will reload the tran data
     * based on the selected query.
     */
    var onChangeSavedQuery = function() {
        logger.fine("onChangeSavedQuery: $scope.selectedSavedQuery=" + JSON.stringify($scope.selectedSavedQuery) );

        if ($scope.selectedSavedQuery != null) {
            // Set the location hash
            $location.search( "savedQuery", $scope.selectedSavedQuery._id );

            logger.fine("onChangeSavedQuery: broadcast $tmLoadSavedQuery savedQuery=" + JSON.stringify($scope.selectedSavedQuery) );
            $rootScope.$broadcast("$tmLoadSavedQuery", $scope.selectedSavedQuery);
        }

    };

    /**
     * Event hanlder for "$tmLoadSavedQuery" event.
     *
     * Update the viewmodel to match the selected saved query in the 
     * combo box with the given saved query.
     *
     * @sideeffect update selectedSavedQuery
     *
     */
    var onLoadSavedQuery = function(theEvent, savedQuery) {
        logger.fine("onLoadSavedQuery: savedQuery=" + JSON.stringify(savedQuery));
        $scope.selectedSavedQuery = savedQuery
    };

    MiscUtils.$on($scope, "$tmLoadSavedQuery", onLoadSavedQuery);

    /**
     * @return the set of savedQueries whose name begins with the searchText.
     */
    var getSavedQueries = function(searchText) {
        logger.fine("getSavedQueries: " + searchText );

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

}])


/**
 * Controller for rendering the tran chart
 */
.controller( "TranChartController", ["$scope", "_",  "Logger", "DateUtils", "Datastore", "ChartUtils", "TranQueryBuilder", "MiscUtils", 
                            function( $scope,   _ ,   Logger,   DateUtils,   Datastore,   ChartUtils,   TranQueryBuilder,   MiscUtils) {

    var logger = Logger.getLogger("TranChartController", { info: false} );
    logger.info("alive!");

    /**
     * Render the tran bar chart.
     */
    var renderChartByDay = function( trans ) {
        logger.fine("renderChartByDay: entry ");

        // Safety check.
        if ( trans.length == 0 ) {
            $scope.tranChartData = {};
            return;
        }

        // Step 1. Convert into labels
        //         The # of labels also tells us how many values there will be
        // Get all date labels from earliest tran (last element) to most recent tran (first element)
        var fromTs = getEarlieastTimestamp_ms( trans );
        var toTs = getLatestTimestamp_ms( trans );
        var labels = DateUtils.createDateLabels( new Date(fromTs), new Date(toTs) );

        // Step 2. Initialize values array
        var values = new Array(labels.length);
        for (var i=0; i < values.length; ++i) {
            values[i] = 0;
        }

        logger.fine("renderChartByDay: aggregate tran values...");

        // Step 3. Transform / reduce trans data 
        // Aggregate tran amounts on a per-day basis
        _.each( trans, 
                function(tran) {
                    var i = DateUtils.dateDiff( 'd', fromTs, tran.timestamp * 1000 );
                    values[i] += tran.amountValue ;
                } );

        // Step 4. Create the positive/negative bar colors.
        var barColors = ChartUtils.createBarColors( values );       // red and green bar colors

        // Step 5. Create the actual values for the chart.
        values = _.map(values, function(val) { return Math.abs(val); } );   // absolute values

        logger.fine("renderChartByDay: values=" + JSON.stringify(values));

        // Step 6. update scope to pass data to the tmChartData directive.
        $scope.tranChartData = buildChartData( ChartUtils.sampleEvenlyAndReplace( labels, 10, "" ),
                                               values,
                                               barColors );

        logger.fine("renderChartByDay: exit");
    };

    /**
     * @return the timestamp from the earliest record. assumes the recors
     *         are in descending order (ie.. it returns the last timestamp in the array).
     */
    var getEarlieastTimestamp_ms = function( trans ) {
        return (trans.length > 0) ? trans[ trans.length-1 ].timestamp * 1000 : 0;
    }

    /**
     * @return the timestamp from the latest record. assumes the recors
     *         are in descending order (ie.. it returns the first timestamp in the array).
     */
    var getLatestTimestamp_ms = function( trans ) {
        return (trans.length > 0) ? trans[0].timestamp * 1000 : 0;
    }

    /**
     * @return chartData object
     */
    var buildChartData = function( labels, values, barColors ) {

        // Setup data frame.
        return {
            labels: labels,
            datasets: [
                {
                    label: "My First dataset",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "rgba(220,220,220,1)",
                    highlightFill: "#fff",
                    highlightStroke: "rgba(220,220,220,1)",
                    data: values,
                    tm: {
                        barColors: barColors
                    }
                }
            ]
        };
    };

    /**
     * Render the tran by month bar chart.
     */
    var renderChartByMonth = function( trans ) {
        logger.fine("renderChartByMonth: entry ");

        // Safety check.
        if ( trans.length == 0 ) {
            $scope.tranChartData = {};
            return;
        }

        // Step 1. Convert into labels
        //         The # of labels also tells us how many values there will be
        // Get all monthLabels from earliest tran (last element) to most recent tran (first element)
        var monthLabels = DateUtils.createMonthLabels( new Date(getEarlieastTimestamp_ms(trans)), 
                                                       new Date(getLatestTimestamp_ms(trans)) );  

        // Step 2. Initialize values array
        // Initialize all values with monthLabel and value.
        var values = new Array(monthLabels.length);
        for (var i=0; i < values.length; ++i) {
            values[i] = { monthLabel: monthLabels[i], value: 0 };
        }

        logger.fine("renderChartByMonth: values=" + JSON.stringify(values));

        // Step 3. Transform / reduce trans data 
        // Aggregate tran amounts on a per-month basis
        _.each( trans, 
                function(tran) {
                    var monthLabel = DateUtils.formatMonthLabel( new Date(tran.timestamp * 1000) );  
                    var value = _.findWhere( values, { monthLabel: monthLabel });
                    value.value += tran.amountValue;
                } );

        var pluckValues =  _.pluck( values, "value");

        // Step 4. Create the positive/negative bar colors.
        var barColors = ChartUtils.createBarColors( pluckValues );    // red and green bar colors

        // Step 5. Create the actual values for the chart.
        var absPluckValues = _.map( pluckValues, function(val) { return Math.abs(val); } );   // absolute values

        logger.fine("renderChartByMonth: monthLabels=" + JSON.stringify(monthLabels));
        logger.fine("renderChartByMonth: values=" + JSON.stringify(values));
        logger.fine("renderChartByMonth: absPluckValues=" + JSON.stringify(absPluckValues));

        // Step 6. Set scope to trigger tmChartData directive.
        $scope.tranChartData = buildChartData( monthLabels, 
                                               absPluckValues,
                                               barColors );
    };

    /**
     * Render the tran by month bar chart.
     */
    var renderChartByTags = function( trans ) {

        currentRenderChartFunction = renderChartByTags;
        logger.fine("renderChartByTags: entry");

        // Safety check.
        if ( trans.length == 0 ) {
            $scope.tranChartData = {};
            return;
        }

        // Step 1. Convert into labels
        //         The # of labels also tells us how many values there will be
        // Get a list of tags that occur in these trans.
        var tagLabels = _.reduce( trans, 
                                  function(memo, tran) {
                                      _.each( tran.tags || [],
                                              function(tag) {
                                                  if ( ! _.contains(memo, tag) ) {
                                                      memo.push(tag);
                                                  }
                                              } );
                                      return memo;
                                  },
                                  [] )
                         .sort();


        // Step 2. Initialize aggregate values
        var tagAmounts = _.reduce( tagLabels,
                                   function( memo, tagLabel ) {
                                       memo[tagLabel] = 0;
                                       return memo;
                                   },
                                   {} );  

        logger.fine("renderChartByTags: values=" + JSON.stringify(tagAmounts));

        // Step 3. Transform / reduce trans data 
        // Aggregate tran amounts on a per-tag basis
        _.each( trans, 
                function(tran) {
                    _.each( tran.tags || [],
                            function(tag) {
                                tagAmounts[tag] += tran.amountValue;
                            });
                } );


        // Step 4. Convert aggregated data to a simple array.
        var tagAmountsArray = _.map( tagLabels, function(tagLabel) { return tagAmounts[tagLabel]; } );
        logger.fine("renderChartByTags: tagAmountsArray=" + JSON.stringify(tagAmountsArray));

        // Step 5. Create the positive/negative bar colors.
        var barColors = ChartUtils.createBarColors( tagAmountsArray );    // red and green bar colors

        // Step 6. Create the actual values for the chart.
        tagAmountsArray = _.map( tagAmountsArray, function(tagAmount) { return Math.abs(tagAmount); } );   

        // Step 7. Set scope to trigger tmChartData directive.
        $scope.tranChartData = buildChartData( tagLabels, 
                                               tagAmountsArray,
                                               barColors );
    };

    /**
     * @return the total number of days the given set of trans span.
     *         it's assumed the trans are in reverse chronological order (by timestamp).
     */
    var getDateSpanForTrans = function(trans) {
        return DateUtils.dateDiff( 'd', 
                                   getEarlieastTimestamp_ms( trans ), 
                                   getLatestTimestamp_ms(trans) );
    }

    /**
     * Render charts with the given set of trans
     */
    var renderChart = function( chartTrans ) {
        currentRenderChartFunction( chartTrans );
    };

    /**
     * Render the chart by day or by month, depending on the size of the data.
     */
    var renderChartByTime = function( chartTrans ) {
        currentRenderChartFunction = renderChartByTime;
        var daysBetween = getDateSpanForTrans( chartTrans );
        if (daysBetween < 155) {
            renderChartByDay( chartTrans );
        }  else {
            renderChartByMonth( chartTrans );
        }
    };

    /**
     * Initialize to by time.
     * This value is updated when user selected on (by tags) or (by time).
     * It's cached so that if the user updates the query, the chart doesn't
     * reset to the initial display.
     */
    var currentRenderChartFunction = renderChartByTime;

    /**
     * @param chartTrans set them on scope in case we want to re-render them by tags or by time.
     * @return chartTrans
     */
    var setChartTrans = function(chartTrans) {
        $scope.chartTrans = chartTrans;
        $scope.isChartThinking = false;
        return chartTrans;
    };

    /**
     * Fetch amounts and tags from all trans (not just a single page),
     * for chart data and full summaries.
     *
     * @return promise fullfilled with all trans
     */
    var fetchTranAmountsAndTags = function(query) {
        var options = TranQueryBuilder.buildOptionsForAmountsAndTags();
        $scope.isChartThinking = true;
        return Datastore.fetchTrans( { query: query, options: options } );
    };

    /**
     * Remember current query to avoid reloading the same data if a dup event gets broadcast.
     */
    var currentQuery = null;

    /**
     * Fetch tran data needed for chart according to the given query
     */
    var onTranQueryUpdated = function(theEvent, query) {
        logger.info("onTranQueryUpdated: query=" + JSON.stringify(query));

        if ( _.isEqual( currentQuery, query ) ) {
            logger.info("onTranQueryUpdated: currentQuery same as updated query. Will not update."
                                            + " currentQuery=" + JSON.stringify(currentQuery)
                                            + ", updated query=" + JSON.stringify(query) );
            return;
        }

        $scope.isChartThinking = true;
        currentQuery = query;

        fetchTranAmountsAndTags( _.extend( {}, query) )
                 .then( setChartTrans )
                 .then( renderChart );
    };

    MiscUtils.$on( $scope, "$tmTranQueryUpdated", onTranQueryUpdated ) ;

    /**
     * Event hanlder for "$tmLoadSavedQuery" event.
     *
     * Load trans for the given query.
     */
    var onLoadSavedQuery = function(theEvent, savedQuery) {
        logger.info("onLoadSavedQuery: savedQuery=" + JSON.stringify(savedQuery));
        onTranQueryUpdated( theEvent, savedQuery.query );
    };

    MiscUtils.$on( $scope, "$tmLoadSavedQuery", onLoadSavedQuery);

    /**
     * Fetch transactions for the given account.
     */
    var onAccountLoaded = function(theEvent, account) {
        logger.info("onAccountLoaded: account=" + JSON.stringify(account));
        var query = TranQueryBuilder.buildQueryForAccount(account); 
        onTranQueryUpdated(theEvent, query);
    };

    MiscUtils.$on( $scope, "$tmAccountLoaded", onAccountLoaded) ;

    /**
     * Export to scope.
     */
    $scope.isChartThinking = true;
    $scope.renderChartByTime = renderChartByTime;
    $scope.renderChartByTags = renderChartByTags;
    $scope.tranChartData = {};

}])


/**
 * Controller for tran lists.
 */
.controller( "TranListController", ["$scope", "_", "Logger", "Datastore", "MiscUtils", "TranQueryBuilder", 
                           function( $scope,   _ ,  Logger,   Datastore,   MiscUtils,   TranQueryBuilder ) {

    var logger = Logger.getLogger("TranListController", { info: false} );
    logger.info("alive!");

    /**
     * For keeping track of paging.
     */
    var currentPage = 0;
    var pageSize = 50;

    /**
     * For remembering the query when fetching the next page.
     */
    var currentQuery = null;

    /**
     * The "more" button ng-click.
     * Fetch the next page of trans.
     */
    var fetchNextPage = function() {
        logger.fine("fetchNextPage: currentPage=" + currentPage);
        currentPage += 1;
        fetchTransByPage( currentQuery, currentPage, pageSize )
            .then( appendTrans );
    }

    /**
     * The "all" button ng-click.
     * Fetch all remaining trans .
     */
    var fetchAllRemainingTrans = function() {
        logger.fine("fetchAllRemainingTrans: currentPage=" + currentPage);
        currentPage += 1;

        var options = TranQueryBuilder.buildOptionsForAllRemainingTrans( currentPage, pageSize );

        fetchTrans( { query: currentQuery, options: options } )
            .then( appendTrans );
    };

    /**
     * @return promise fulfilled with trans
     */
    var fetchTransByPage = function(query, page, pageSize) {
        logger.fine("fetchTransByPage: query=" + JSON.stringify(query) + ", page=" + page + ", pageSize=" + pageSize);
        var options = TranQueryBuilder.buildOptionsForNextPageOfTrans( page, pageSize );
        return fetchTrans( { query: query, options: options } );
    };

    /**
     * Callback after fetching trans from the db.
     *
     * @return  $scope.trans, after being appended by the given trans.
     */
    var setTrans = function(trans) {
        resetTranList();
        appendTrans(trans);
    }

    /**
     * Callback after fetching trans from the db.
     *
     * @return  $scope.trans, after being appended by the given trans.
     */
    var appendTrans = function(trans) {

        $scope.isThinking = false;

        Array.prototype.push.apply( $scope.trans, trans); 

        $scope.transSums["amountValue"] = MiscUtils.sumField( $scope.trans, "amountValue" );

        // Mark "areAllTransFetched" = true, which will hid the "more" button.
        if (trans.length < pageSize) {
            $scope.areAllTransFetched = true;
        }

        logger.fine("appendTrans: areAllTransFetched=" + $scope.areAllTransFetched);
        return $scope.trans;
    };

    /**
     * @return promise, fullfilled with tran data.
     */
    var fetchTrans = function(postData) {
        logger.fine("fetchTrans: postData=" + JSON.stringify(postData));
        $scope.isThinking = true;
        return Datastore.fetchTrans( postData );
    };

    /**
     * Fetch the total number of trans for the account.
     */
    var fetchTransSummary = function(query) {
        logger.fine("fetchTransSummary: query=" + JSON.stringify(query));
        Datastore.fetchTransSummary( { query: query } )
                 .then( function(transSummary) { 
                            logger.fine("fetchTransSummary: transSummary=" + JSON.stringify(transSummary));
                            $scope.transSummary = transSummary;
                        });
    };

    /**
     * Reset the trans array and the page number.
     */
    var resetTranList = function() {
        $scope.trans = [];
        currentPage = 0;
        $scope.areAllTransFetched = false;
    };

    /**
     * Fetch tran list in response to updated query.
     */
    var onTranQueryUpdated = function(theEvent, query) {
        logger.info("onTranQueryUpdated: query=" + JSON.stringify(query));

        if ( _.isEqual( currentQuery, query ) ) {
            logger.info("onTranQueryUpdated: currentQuery same as updated query. Will not update."
                                            + " currentQuery=" + JSON.stringify(currentQuery)
                                            + ", updated query=" + JSON.stringify(query) );
            return;
        }

        currentQuery = query;

        resetTranList();

        $scope.isThinking = true;

        fetchTransSummary( query );     // TODO: can roll this into fetchTranAmountsAndTags (TranChartController)

        fetchTransByPage( query, currentPage, pageSize )
                 // Append trans to scope.
                 .then( setTrans );
    };

    MiscUtils.$on( $scope, "$tmTranQueryUpdated", onTranQueryUpdated ) ;

    /**
     * Event hanlder for "$tmLoadSavedQuery" event.
     *
     * Load trans for the given query.
     */
    var onLoadSavedQuery = function(theEvent, savedQuery) {
        logger.info("onLoadSavedQuery: savedQuery=" + JSON.stringify(savedQuery));
        onTranQueryUpdated( theEvent, savedQuery.query );
    };

    MiscUtils.$on($scope, "$tmLoadSavedQuery", onLoadSavedQuery);

    /**
     * Fetch transactions for the given account.
     */
    var onAccountLoaded = function(theEvent, account) {
        logger.info("onAccountLoaded: account=" + JSON.stringify(account));
        var query = TranQueryBuilder.buildQueryForAccount(account); 
        onTranQueryUpdated(null, query);
    };

    MiscUtils.$on( $scope, "$tmAccountLoaded", onAccountLoaded) ;

    /**
     * Export to scope
     */
    $scope.isThinking = true;
    $scope.trans = [];
    $scope.transSums = {};  
    $scope.transSummary = { "count": "xx", 
                            "amountValue": 0 
                          };

    $scope.fetchNextPage = fetchNextPage;
    $scope.fetchAllRemainingTrans = fetchAllRemainingTrans;
    $scope.areAllTransFetched = false;

}])

/**
 * Controller for trans.html
 */
.controller( "TranPageController", ["$scope", "$location", "Logger",  "Datastore", "MiscUtils", "$rootScope", "$timeout",
                           function( $scope,   $location,   Logger,    Datastore,   MiscUtils,   $rootScope,   $timeout) {

    var logger = Logger.getLogger("TranPageController", { all: false } );
    logger.info("alive!");

    /**
     * We must be embedded in the trans.html page.
     * Fetch all trans.
     */
    var loadAllTrans = function() {
        MiscUtils.$broadcast( "$tmTranQueryUpdated", {} ) ;
    };

    /**
     * Executes when the page loads.
     * Check $location for savedQuery, otherwise load all trans.
     *
     * Note: this is causing the trans to be loaded twice, because the 
     *       $tmLoadSavedQuery event is being emitted twice:
     *       1. here
     *       2. in SaveQueryFormController, when selectedSavedQuery is updated (onChangeSavedQuery)
     *       
     *       The listeners for $tmLoadSavedQuery handle the dup event by keeping
     *       track of the currentQuery and comparing it to the new query and only updating
     *       the view if the queries differ.
     *      
     */
    var onLoad = function() {

        if ( ! MiscUtils.isEmpty( $location.search().savedQuery ) ) {

            logger.fine("onLoad: fetching saved query " + $location.search().savedQuery );
            Datastore.fetchSavedQuery( $location.search().savedQuery )
                     .then( function( savedQuery ) {
                                if (savedQuery != null) {
                                    logger.fine("onLoad: broadcasting saved query " + JSON.stringify(savedQuery) );
                                    MiscUtils.$broadcast("$tmLoadSavedQuery", savedQuery);
                                } else {
                                    loadAllTrans();
                                }
                            } );
        } else {
            loadAllTrans();
        }
    }

    onLoad();

    // Populate tags for auto-fill.
    Datastore.fetchTags()
             .then( function success(tags) { $scope.tags = tags; } ); 

    // Listens for $tmAddTranTag events.
    MiscUtils.listenForAddTranTag($scope, logger);

}])


/**
 * Controller for the tran query form.
 * Broadcasts $tmTranQueryUpdated events.
 * Listens for $tmLoadSavedQuery events.
 */
.controller( "TranQueryController", ["$scope", "_",  "Logger",  "MiscUtils", "TranQueryBuilder", "$rootScope", "$timeout",
                            function( $scope,   _ ,   Logger,    MiscUtils,   TranQueryBuilder,   $rootScope,   $timeout) {

    var logger = Logger.getLogger("TranQueryController", { all: false } );
    logger.info("alive!");

    /**
     * Called from the view.
     */
    var onQueryFormSubmit = function() {

        logger.fine("onQueryFormSubmit: entry");
        $scope.postData.query = TranQueryBuilder.buildQuery($scope);

        MiscUtils.$broadcast( "$tmTranQueryUpdated", $scope.postData.query ) ;
    };

    /**
     * Called from the view.
     * Called when the user hits 'enter' after typing in a tag in the "Tags Inclusion Filter".
     * Add the tag to tagsFilter
     */
    var addTag = function() {
        logger.fine("addTag: " + $scope.inputTagFilter);
        var tag = $scope.inputTagFilter;

        // Clear the input field.
        $scope.inputTagFilter = "";

        if (MiscUtils.isEmpty(tag)) {
            return;
        }

        if ( ! _.contains($scope.tagsFilter, tag) ) {
            $scope.tagsFilter.push(tag);
            logger.fine("addTag: $scope.tagsFilter=" + JSON.stringify($scope.tagsFilter));
        }
    };

    /**
     * Called from the view.
     * Called when the user hits 'enter' after typing in a tag in the "Tags Exclusion Filter".
     * Add the tag to tagsExcludeFilter
     */
    var addTagExclude = function() {
        logger.fine("addTagExclude: " + $scope.inputTagExcludeFilter);
        var tag = $scope.inputTagExcludeFilter;

        // Clear the input field.
        $scope.inputTagExcludeFilter = "";

        if (MiscUtils.isEmpty(tag)) {
            return;
        }

        if ( ! _.contains($scope.tagsExcludeFilter, tag) ) {
            $scope.tagsExcludeFilter.push(tag);
            logger.fine("addTagExclude: $scope.tagsExcludeFilter=" + JSON.stringify($scope.tagsExcludeFilter));
        }
    };

    /**
     * Called from the view.
     * Remove the tag from the tagsFilter list
     */
    var removeTag = function(tag) {
        $scope.tagsFilter = _.filter( $scope.tagsFilter, function(t) { return t != tag; } );
        logger.fine("removeTag: " + tag + ", $scope.tagsFilter=" + JSON.stringify($scope.tagsFilter) );
    };

    /**
     * Called from the view.
     * Remove the tag from the tagsExludeFilter list
     */
    var removeTagExclude = function(tag) {
        $scope.tagsExcludeFilter = _.filter( $scope.tagsExcludeFilter, function(t) { return t != tag; } );
        logger.fine("removeTagExclude: " + tag + ", $scope.tagsExcludeFilter=" + JSON.stringify($scope.tagsExcludeFilter) );
    };

    /**
     * Event hanlder for "$tmLoadSavedQuery" event.
     *
     * @sideeffect update $scope.postData and reload trans.
     *
     */
    var onLoadSavedQuery = function(theEvent, savedQuery) {
        logger.fine("onLoadSavedQuery: savedQuery=" + JSON.stringify(savedQuery));

        $scope.postData.query = savedQuery.query;

        // Reset all form data before parsing the query.
        $scope.startDate = null;
        $scope.endDate = null;
        $scope.tagsFilter = [];
        $scope.tagsExcludeFilter = [];
        $scope.inputMerchant = "";

        // parse the query and fill in the form with the query parms
        $scope = _.extend( $scope, TranQueryBuilder.parseQuery( savedQuery.query ) );

        logger.fine("onLoadSavedQuery: after parse: " 
                            + "$scope.startDate=" + $scope.startDate
                            + ", $scope.endDate=" + $scope.endDate
                            + ", $scope.tagsFilter=" + JSON.stringify($scope.tagsFilter)
                            + ", $scope.tagsExcludeFilter=" + JSON.stringify($scope.tagsExcludeFilter) );
    };

    MiscUtils.$on($scope, "$tmLoadSavedQuery", onLoadSavedQuery);

    /**
     * Export to scope.
     */
    $scope.addTag = addTag;
    $scope.removeTag = removeTag;
    $scope.tagsFilter = [];

    $scope.addTagExclude = addTagExclude;
    $scope.removeTagExclude = removeTagExclude;
    $scope.tagsExcludeFilter = [];
    $scope.onQueryFormSubmit = onQueryFormSubmit;

    $scope.startDate = null;
    $scope.endDate = null;
    $scope.postData = {};
    $scope.MiscUtils = MiscUtils;

}])


/**
 * Controller for tags.html
 */
.controller( "TagsPageController",   ["$scope", "_", "Logger", "DateUtils", "Datastore", "MiscUtils", "$location",
                             function( $scope,   _,   Logger,   DateUtils,   Datastore,   MiscUtils,   $location ) {

    var logger = Logger.getLogger("TagsPageController", { all: false});
    logger.info("alive! $location.search=" + JSON.stringify($location.search()) );

    /**
     * @return the tags from the query string.
     */
    var parseTagsFromLocation = function() {
        var retMe = $location.search().tags || [ "bills", "income" ] ;
        logger.fine("parseTagsFromLocation: retMe=" + JSON.stringify(retMe));
        return _.isArray(retMe) ? retMe : [ retMe ] ;
    };

    /**
     * @return the appropriate accountType query based on the given accountTypes
     */
    var buildTransByTagByMonthQueryForTags = function(tags) {
        var query = { "tag": { "$in": tags } } ;
        return query;
    };

    /**
     * Determine which tags to load based on query string.
     */
    var onLoad = function() {

        var options = { "sort": { "yearMonth": 1 } };

        $scope.byTags = parseTagsFromLocation();

        var query = buildTransByTagByMonthQueryForTags( $scope.byTags );

        // Datastore will broadcast the $tmAccountsLoaded event.
        logger.fine("onLoad: queryTagsByMonth postData=" + JSON.stringify( { query: query, options: options } ));

        // Note: Broadcasts the $tmTagsByMonthLoaded
        Datastore.queryTagsByMonth( { query: query, options: options }, true )
                 .then( _.partial( MiscUtils.$broadcast, "$tmTagsByMonthLoaded" ) );

    };

    /**
     * Listen for location changes
     * Note: the initial page load generates a $locationChangeSuccess event, which is
     *       how we load the initial data.
     */
    var onLocationChangeSuccess = function(theEvent, currentLocation, previousLocation) {
        logger.info("onLocationChangeSuccess: currentLocation=" + currentLocation
                                            + ", previousLocation=" + previousLocation );
        onLoad();
    };

    $scope.$on( "$locationChangeSuccess", onLocationChangeSuccess );

    // Populate tags.
    Datastore.fetchTags()
             .then( function success(tags) { $scope.tags = tags; } ); 

    // Listens for $tmAddTranTag events.
    MiscUtils.listenForAddTranTag($scope, logger);

}])


/**
 * For the tags by month chart.
 *
 * Listens for $tmTagsByMonthLoaded
 */
.controller( "TagsByMonthChartController",   ["$scope", "_", "Logger", "DateUtils", "ChartUtils", "MiscUtils", 
                                     function( $scope,   _ ,  Logger,   DateUtils,   ChartUtils,   MiscUtils ) {

    var logger = Logger.getLogger("TagsByMonthChartController", {all:false});
    logger.info("alive!");

    /**
     * TODO: this is duplicated 
     *
     * @param tagsByMonthList - tagsByMonth records.  expected to be for a single tag only.
     *
     * @return a chart dataset for the tagsByMonthList data 
     */
    var buildTagByMonthDataset = function( monthLabels, tagsByMonthList ) {

        logger.fine("buildTagByMonthDataset: monthLabels=" + JSON.stringify(monthLabels)
                                            + ", tagsByMonthList=" + JSON.stringify(tagsByMonthList) );

        // Step 1. Initialize values array
        // Initialize all values with monthLabel and value.
        // There's a values[] entry for each monthLabel.
        var values = new Array(monthLabels.length);
        for (var i=0; i < values.length; ++i) {
            values[i] = { monthLabel: monthLabels[i], value: 0 };
        }

        // Step 2. Map the tagsByMonth records into the values[] array
        // by matching the monthLabel of the tagsByMonth record into the values[] array.
        _.each( tagsByMonthList, 
                function(tagByMonth) {
                    var monthLabel = DateUtils.formatMonthLabel( DateUtils.parseYearMonthString( tagByMonth.yearMonth ) );  
                    var value = _.findWhere( values, { monthLabel: monthLabel });   // Find the slot in the values[] array for this monthLabel
                    value.value += tagByMonth.sumAmountValue;
                } );

        var pluckValues =  _.pluck( values, "value");

        // Step 3. Create the positive/negative bar colors.
        var barColors = ChartUtils.createBarColors( pluckValues );    // red and green bar colors

        // Step 4. Create the actual values for the chart.
        var absPluckValues = _.map( pluckValues, function(val) { return Math.abs(val); } );   // absolute values

        logger.fine("buildTagByMonthDataset: monthLabels=" + JSON.stringify(monthLabels));
        logger.fine("buildTagByMonthDataset: values=" + JSON.stringify(values));
        logger.fine("buildTagByMonthDataset: absPluckValues=" + JSON.stringify(absPluckValues));

        // Step 5. Build and return dataset.
        return {
                    label: tagsByMonthList[0].tag,
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "rgba(220,220,220,1)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    data: absPluckValues,
                    tm: { 
                        barColors: barColors
                    }
                };
    };


    /**
     * Render the tagsByMonth data .
     *
     * @param tagsByMonth, expected to be in chronological order ascending.
     */
    var renderChart = function( tagsByMonth ) {
        logger.fine("renderChart: entry");

        if (tagsByMonth.length == 0) {
            $scope.chartData = {};
            return;
        }

        // Step 1. Convert into labels
        //         The # of labels also tells us how many values there will be
        // Get all monthLabels from earliest record (first element) to today
        var monthLabels = DateUtils.createMonthLabels( DateUtils.parseYearMonthString( tagsByMonth[0].yearMonth ),
                                                       new Date() );     // today

        // Step 2. Transmute tagsByMonth record list into tagsByMonth map, where the records
        //         are sorted by tag.
        //         tagsByMonthMap[tag] = [ tagsByMonthRecord, tagsByMonthRecord, ... ] ;
        //
        var tagsByMonthMap = _.reduce(tagsByMonth,
                                      function(memo, tagByMonth) {
                                          memo[tagByMonth.tag] = memo[tagByMonth.tag] || [];
                                          memo[tagByMonth.tag].push( tagByMonth );
                                          return memo;
                                      },
                                      {} );

        // Step 3. Map records into datasets.
        var tagsByMonthDatasets = _.map( _.values( tagsByMonthMap ), _.partial( buildTagByMonthDataset, monthLabels ) );

        // Step 4. Setup chartData
        $scope.chartTitle = "Tag(s): " + _.pluck( tagsByMonthDatasets, "label" ).join(", ");
        // Setup data frame.
        $scope.chartData = {
            labels: monthLabels,
            datasets: tagsByMonthDatasets
        };
    };

    /**
     * @param tagsByMonth records
     * @return tagsByMonth
     */
    var setTagsByMonth = function(tagsByMonth) {
        $scope.tagsByMonth = tagsByMonth;
        $scope.isChartThinking = false;
        return tagsByMonth;
    };

    /**
     * For detecting duplicate events.
     */
    var DupEventChecker = MiscUtils.getDupEventChecker( logger );

    /**
     * Listener for $tmTagsByMonthLoaded events.
     *
     * Fetch timeseries data for the given accountId
     * $tmAccountIdSelected emitted by AccountPageController and AccountsPageController.
     */
    var onTagsByMonthLoaded = function(theEvent, tagsByMonth) {
        logger.info("onTagsByMonthLoaded: tagsByMonth=" + JSON.stringify(tagsByMonth));

        // Check for dup event.
        if ( DupEventChecker.isDupEvent(tagsByMonth) ) {
            return;
        }

        setTagsByMonth( tagsByMonth );
        renderChart( tagsByMonth );
    };

    MiscUtils.$on( $scope, "$tmTagsByMonthLoaded", onTagsByMonthLoaded ) ;

    $scope.isChartThinking = true;
    $scope.chartData = {};

}])


/**
 * Tag-by-month chart controller for a single tag.
 *
 */
.controller( "TagByMonthChartController",   ["$scope", "_", "Logger", "DateUtils", "Datastore", "ChartUtils", "MiscUtils", 
                                    function( $scope,   _ ,  Logger,   DateUtils,   Datastore,   ChartUtils,   MiscUtils ) {

    var logger = Logger.getLogger("TagByMonthChartController", {all:false});
    logger.info("alive!");

    /**
     * @param tagsByMonthList - tagsByMonth records.  expected to be for a single tag only.
     *
     * @return a chart dataset for the tagsByMonthList data 
     */
    var buildTagByMonthDataset = function( monthLabels, tagsByMonthList ) {

        logger.fine("buildTagByMonthDataset: monthLabels=" + JSON.stringify(monthLabels)
                                            + ", tagsByMonthList=" + JSON.stringify(tagsByMonthList) );

        // Step 1. Initialize values array
        // Initialize all values with monthLabel and value.
        // There's a values[] entry for each monthLabel.
        var values = new Array(monthLabels.length);
        for (var i=0; i < values.length; ++i) {
            values[i] = { monthLabel: monthLabels[i], value: 0 };
        }

        // Step 2. Map the tagsByMonth records into the values[] array
        // by matching the monthLabel of the tagsByMonth record into the values[] array.
        _.each( tagsByMonthList, 
                function(tagByMonth) {
                    var monthLabel = DateUtils.formatMonthLabel( DateUtils.parseYearMonthString( tagByMonth.yearMonth ) );  
                    var value = _.findWhere( values, { monthLabel: monthLabel });   // Find the slot in the values[] array for this monthLabel
                    value.value += tagByMonth.sumAmountValue;
                } );

        var pluckValues =  _.pluck( values, "value");

        // Step 3. Create the positive/negative bar colors.
        var barColors = ChartUtils.createBarColors( pluckValues );    // red and green bar colors

        // Step 4. Create the actual values for the chart.
        var absPluckValues = _.map( pluckValues, function(val) { return Math.abs(val); } );   // absolute values

        logger.fine("buildTagByMonthDataset: monthLabels=" + JSON.stringify(monthLabels));
        logger.fine("buildTagByMonthDataset: values=" + JSON.stringify(values));
        logger.fine("buildTagByMonthDataset: absPluckValues=" + JSON.stringify(absPluckValues));

        // Step 5. Build and return dataset.
        return {
                    label: tagsByMonthList[0].tag,
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "rgba(220,220,220,1)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    data: absPluckValues,
                    tm: { 
                        barColors: barColors
                    }
                };
    };


    /**
     * Render the tagsByMonth data .
     *
     * @param tagByMonthList, expected to be in chronological order ascending.
     */
    var buildChartData = function( tagByMonthList ) {
        logger.fine("buildChartData: entry");

        if (tagByMonthList.length == 0) {
            $scope.chartData = {};
            return;
        }

        // Step 1. Convert into labels
        //         The # of labels also tells us how many values there will be
        // Get all monthLabels from earliest record (first element) to today
        var monthLabels = DateUtils.createMonthLabels( DateUtils.parseYearMonthString( tagByMonthList[0].yearMonth ),
                                                       new Date() );     // today

        // Step 2. Map records into datasets.
        var chartDataset = buildTagByMonthDataset( monthLabels, tagByMonthList );

        // Step 3. Setup data frame.
        $scope.chartData = {
            labels: monthLabels,
            datasets: [ chartDataset ]
        };

        logger.fine("buildChartData: $scope.chartData=" + JSON.stringify($scope.chartData) );
    };

    /**
     * @param tagsByMonth records
     * @return tagsByMonth
     */
    var setTagsByMonth = function(tagsByMonth) {
        $scope.tagsByMonth = tagsByMonth;
        $scope.isChartThinking = false;
        return tagsByMonth;
    };

    /**
     * Load the tag-by-month data for this tag.
     */
    var tagOnClick = function() {

        $scope.isChartVisible = !$scope.isChartVisible;

        logger.fine("tagOnClick: entry: tag=" + $scope.tag + ", isChartVisible=" + $scope.isChartVisible );
        
        if (!$scope.isChartVisible) {
            // User has hidden the chart.  Nothing more to do here.
            return;
        }

        var query = { "tag": $scope.tag } ;
        var options = { "sort": { "yearMonth": 1 } };

        // Fetch the tag-by-month data
        Datastore.queryTagsByMonth( { query: query, options: options } )
                 .then( setTagsByMonth )
                 .then( buildChartData );
    };

    /**
     * Export to scope.
     */
    $scope.isChartVisible = false;
    $scope.chartData = {};
    $scope.tagOnClick = tagOnClick;

}])

/**
 * This month and last month's spending chart, by tag. 
 */
.controller( "ThisMonthByTagController",   ["$scope", "_", "Logger", "DateUtils", "Datastore", "ChartUtils", "MiscUtils", 
                                   function( $scope,   _ ,  Logger,   DateUtils,   Datastore,   ChartUtils,   MiscUtils ) {

    var logger = Logger.getLogger("ThisMonthByTagController", {all:false});
    logger.info("alive!");

    /**
     * @param tagsByMonthList - tagsByMonth records.  expected to be for a single yearMonth only.
     *
     * @return a chart dataset for the tagsByMonthList data 
     */
    var buildTagsByMonthDataset = function( tagsByMonthList ) {

        logger.fine("buildTagsByMonthDataset: tagsByMonthList=" + JSON.stringify(tagsByMonthList) );

        // Step 1. Get the chart values
        var pluckValues =  _.pluck( tagsByMonthList, "sumAmountValue");

        // Step 2. Create the positive/negative bar colors.
        var barColors = ChartUtils.createBarColors( pluckValues );    // red and green bar colors

        // Step 3. Create the actual abs values for the chart.
        var absPluckValues = _.map( pluckValues, function(val) { return Math.abs(val); } );   // absolute values

        logger.fine("buildTagsByMonthDataset: absPluckValues=" + JSON.stringify(absPluckValues));

        // Step 5. Build and return dataset.
        return {
                    label: "Tags By Month",
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "rgba(220,220,220,1)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    data: absPluckValues,
                    tm: { 
                        barColors: barColors
                    }
                };
    };

    /**
     * Render the tagsByMonth data .
     *
     * @param tagsByMonthList, expected to be in sumAmountValue order ascending 
     *
     * @return chartData
     */
    var buildChartData = function( tagsByMonthList ) {

        logger.fine("buildChartData: entry");

        if (tagsByMonthList.length == 0) {
            $scope.chartData = {};
            return;
        }

        // Step 1. Get the labels.
        var tagLabels = _.pluck( tagsByMonthList, "tag" ) ;

        // Step 2. Map records into datasets.
        var chartDataset = buildTagsByMonthDataset( tagsByMonthList );

        // Step 3. Setup data frame.
        var chartData = {
            labels: tagLabels,
            datasets: [ chartDataset ]
        };

        logger.fine("buildChartData: chartData=" + JSON.stringify(chartData) );

        return chartData;
    };

    /**
     * Set $scope.thisMonthChartData, which triggers the tm-chart-data directive 
     * to render the chart.
     */
    var setThisMonthChartData = function(chartData) {
        $scope.isThisMonthChartThinking = false;
        $scope.thisMonthChartData = chartData;
    };

    /**
     * Set $scope.lastMonthChartData, which triggers the tm-chart-data directive 
     * to render the chart.
     */
    var setLastMonthChartData = function(chartData) {
        $scope.isLastMonthChartThinking = false;
        $scope.lastMonthChartData = chartData;
    };

    /**
     * Fetch tagsByMOnth data for this month
     */
    var fetchThisMonthTags = function() {
        var query = { "yearMonth": DateUtils.formatYearMonth( new Date() ),
                      "tag": { "$nin": [ "bills", "income" ] } 
                    } ;
        var options = { "sort": { "sumAmountValue": 1 } };

        $scope.isThisMonthChartThinking = true;

        // Fetch the tag-by-month data
        Datastore.queryTagsByMonth( { query: query, options: options } )
                 .then( buildChartData )
                 .then( setThisMonthChartData );
    };

    /**
     * Fetch tagsByMOnth data for last month
     */
    var fetchLastMonthTags = function() {

        var d = new Date();
        d.setMonth( d.getMonth() - 1 );     // rewind 1 month

        var query = { "yearMonth": DateUtils.formatYearMonth( d ),
                      "tag": { "$nin": [ "bills", "income" ] } 
                    };
        var options = { "sort": { "sumAmountValue": 1 } };

        $scope.isLastMonthChartThinking = true;

        // Fetch the tag-by-month data
        Datastore.queryTagsByMonth( { query: query, options: options } )
                 .then( buildChartData )
                 .then( setLastMonthChartData );
    };

    /**
     * Load the tags-by-month data for this yearMonth.
     */
    var onLoad = function() {

        fetchThisMonthTags();
        fetchLastMonthTags();
    };

    /**
     * init.
     */
    $scope.isThisMonthChartThinking = false;
    $scope.isLastMonthChartThinking = false;

    /**
     * Kick things off.
     */
    onLoad();

}])

;



