angular.module( "MyApp",  ['puElasticInput', 'ngMaterial'] )

/**
 * TODO: separate controllers for subsets of accounts? then the summation html could be ng-included.
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

        setAccountSums($scope.bankAndCreditAccountsSums, $scope.bankAndCreditAccounts);

        $scope.investmentAccounts = _.filter( $scope.accounts, 
                                                 function(account) { 
                                                     return ! (account.accountType == "credit" || account.accountType == "bank");
                                                 } );
        setAccountSums($scope.investmentAccountsSums, $scope.investmentAccounts);
    };

    /**
     * Sums the account fiels ["value", "last7days", "last30days", "last90days", "last365days" ]
     * and puts the sums in the given sums object, keyed by field name.
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
 * NewTransController
 */
.controller( "NewTransController",   ["$scope", "_", "Logger", "Datastore", "MiscUtils",
                             function( $scope,   _,   Logger,   Datastore,   MiscUtils ) {

    var logger = Logger.getLogger("NewTransController");
    logger.info("NewTransController: alive!");

    /**
     * Called when a tran is ACKed.   Remove the tran from the list.
     */
    var onAckTran = function(theEvent, tranId) {

        logger.info("NewTransController.onAckTran: tranId=" + tranId);

        // remove it from the list locally (faster)
        $scope.newTrans = _.filter( $scope.newTrans, function(tran) { return tran._id != tranId } );
    };

    /**
     * Listens for $addTranTag events.
     */
    var onAddTranTag = function(theEvent, tag) {
        logger.info("NewTransController.onAddTranTag: tag=" + tag + ", $scope.tags=" + JSON.stringify($scope.tags));

        if ( ! _.contains($scope.tags, tag) ) {
            $scope.tags.push(tag);
        }
    };

    /**
     * Export to $scope
     */
    $scope.newTrans = [];
    $scope.sumField = MiscUtils.sumField;
    $scope.MiscUtils = MiscUtils;

    $scope.$on("$addTranTag", onAddTranTag );
    $scope.$on("$ackTran", onAckTran);

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
        logger.info("TagFormController.putTranTags: " + JSON.stringify($scope.tran.tags));
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
            logger.info("TagFormController.addTranTag: $rootScope.$broadcast(event=$addTranTag, tag=" + tag + ")");
            $rootScope.$broadcast("$addTranTag", tag);
        }
    }

    /**
     * Called when the user hits 'enter' after typing in a tag.
     * Add the tag to the tran.
     */
    var onFormSubmit = function() {
        logger.info("TagFormController.onFormSubmit: " + $scope.inputTag);
        addTranTag( $scope.inputTag )
    }

    /**
     * Remove the tag from the tran.
     */
    var removeTag = function(tag) {

        // remove it from the tags list 
        $scope.tran.tags = _.filter( $scope.tran.tags, function(t) { return t != tag; } );
        logger.info("TagFormController.removeTag: " + tag + ", $scope.tran.tags=" + JSON.stringify($scope.tran.tags) );

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

        logger.info("TranAckFormController.ackTran: $rootScope.$broadcast(event=$ackTran, tranId=" + tranId + ")");
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

    var logger = Logger.getLogger("tmAutoFill");

    var directiveDefiningObj = {
        require: "ngModel",
        link: function($scope, element, attrs, ngModel) {

                  logger.fine("tmAutoFill.link: entry");

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

                      logger.fine("tmAutoFill.autofill: element.val()=" + element.val()
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
                      logger.fine("directive::tnWatchInput.keydown: $scope.inputTag=" + $scope.inputTag 
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

    var logger = Logger.getLogger("AccountController");

    logger.info("AccountController: alive! $location.search=" + JSON.stringify($location.search()));

    /**
     * Remember theChart so we can clear its data when the data is updated.
     */
    var chartCanvasElement = document.getElementById("valueChart");
    var theChart = null;

    /**
     * TODO: chart rendering shoudl be done in directive? (since it access the DOM)
     * Render the current balance chart.
     */
    var renderChart = function( accountTimeSeries ) {
        logger.info("AccountController.renderChart: ");

        if (theChart != null) {
            logger.info("AccountController.renderChart: clearing previous chart");
            theChart.destroy();
        }

        if (accountTimeSeries.length == 0) {
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

        logger.info("AccountController.renderChart: sampleRate=" + sampleRate 
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
        theChart = new Chart(chartCanvasElement.getContext("2d"))
                         .Line(data, { responsive: true });
    };

    /**
     * @return the accountId from the query string.
     */
    var parseAccountIdFromLocation = function() {
        return $location.search().accountId || 0;
    }

    /**
     * @param accountTimeSeries set into scope
     * @return accountTimeSeries
     */
    var setAccountTimeSeries = function(accountTimeSeries) {
        $scope.accountTimeSeries = accountTimeSeries;
        $scope.isChartThinking = false;
        return accountTimeSeries;
    };

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
     * Export to scope.
     */
    $scope.DateUtils = DateUtils;
    $scope.MiscUtils = MiscUtils;
    $scope.isChartThinking = true;
    $scope.isThinking = true;

    /**
     * Go!
     */
    Datastore.fetchAccount( parseAccountIdFromLocation() )
             .then( setAccount );

    Datastore.fetchAccountTimeSeries( parseAccountIdFromLocation() )
             .then( setAccountTimeSeries ) 
             .then( renderChart );

}])


/**
 * Logger
 */
.factory("Logger", [ function() {

    var name = "RootLogger";

    var info = function(msg) {
        console.log(msg);
    }

    var fine = function(msg) {
        console.log(msg);
    }

    var severe = function(msg) {
        alert(msg);
    }

    var getLogger = function( name, options ) {
        options = _.extend( { all: false, info: false, fine: false, severe: true }, options );
        return {
            info: function(msg) { if (options.info || options.all) { info( name + ": " + msg); } },
            fine: function(msg) { if (options.fine || options.all) { fine( name + ": " + msg); } },
            severe: function(msg) { if (options.severe || options.all) { severe( name + ": " + msg); } },
        };
    }

    return {
        info: info,
        fine: fine,
        severe: severe,
        getLogger: getLogger
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

    var logger = Logger.getLogger("SaveQueryFormController");

    logger.info("SaveQueryFormController: Alive!");


    /**
     * Called when the form is submitted.
     * Add a new saved query to the database.
     */
    var saveQuery = function() {
       
        var newSavedQuery = { name: $scope.inputSavedQueryName, 
                              query: $scope.postData.query };
        
        logger.info("SaveQueryFormController.saveQuery: $scope.inputSavedQueryName=" + $scope.inputSavedQueryName
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

                            alert( "Current query saved as '" + newSavedQuery.name + "'");
                        } );
    };

    /**
     * Set the savedQueries into scope and sort them by name.
     */
    var setSavedQueries = function(savedQueries) {
        $scope.savedQueries = _.sortBy( savedQueries, "name" );
        logger.info("SaveQueryFormController.setSavedQueries: " + JSON.stringify( $scope.savedQueries ) );
    };

    /**
     * Broadcast $loadSavedQuery event, which will be heard by the
     * parent controller TranQueryController, which will reload the tran data
     * based on the selected query.
     */
    var onChangeSavedQuery = function() {
        logger.info("SaveQueryFormController.onChangeSavedQuery: $scope.selectedSavedQuery=" + JSON.stringify($scope.selectedSavedQuery) );

        if ($scope.selectedSavedQuery != null) {
            $rootScope.$broadcast("$loadSavedQuery", $scope.selectedSavedQuery);
        }

    };

    /**
     * @return the set of savedQueries whose name begins with the searchText.
     */
    var getSavedQueries = function(searchText) {
        logger.info("SaveQueryFormController.getSavedQueries: " + searchText );

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
 * Controller for tran lists and queries.
 */
.controller( "TranQueryController", ["$scope", "_", "$location", "Logger", "DateUtils", "Datastore", "MiscUtils", "ChartUtils", "TranQueryBuilder",
                            function( $scope,   _ ,  $location,   Logger,   DateUtils,   Datastore,   MiscUtils,   ChartUtils,   TranQueryBuilder) {

    var logger = Logger.getLogger("TranQueryController", { all: false} );

    logger.info("TranQueryController: alive! $location.search=" + JSON.stringify($location.search()));

    /**
     * Remember charts so we can clear them when the tran list is updated.
     */
    var tranChart = null;
    var tranCanvasElement = document.getElementById("tm-tran-canvas-element");

    /**
     * Render the tran bar chart.
     */
    var renderChartByDay = function( trans ) {
        logger.info("TranQueryController.renderChartByDay: ");

        destroyTranChart( tranChart );

        // Safety check.
        if ( trans.length == 0  || tranCanvasElement == null) {
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

        logger.info("TranQueryController.renderChartByDay: aggregate tran values...");

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

        logger.info("TranQueryController.renderChartByDay: values=" + JSON.stringify(values));

        renderChartWithThisData( ChartUtils.sampleEvenlyAndReplace( labels, 10, "" ),
                                 values,
                                 barColors );

        logger.info("TranQueryController.renderChartByDay: exit");
    };


    /**
     * calls tranChart.destroy
     */
    var destroyTranChart = function(tranChart) {
        if (tranChart != null) {
            logger.info("TranQueryController.destroyTranChart: clearing previous tran chart");
            tranChart.destroy();
        }
    }

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
     * Render the chart with the given data and bar colors.
     */
    var renderChartWithThisData = function( labels, values, barColors ) {

        // Setup data frame.
        var data = {
            labels: labels,
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
        // -rx- tranCanvasElement.setAttribute("height", "350");
        tranChart = new Chart(tranCanvasElement.getContext("2d"))
                                    .Bar(data, { responsive: true });

        ChartUtils.setBarColors(tranChart, barColors);
        logger.info("TranQueryController.renderChartWithThisData: exit");
    }

    /**
     * Render the tran by month bar chart.
     */
    var renderChartByMonth = function( trans ) {
        logger.info("TranQueryController.renderChartByMonth: ");

        destroyTranChart(tranChart);

        // Safety check.
        if ( trans.length == 0  || tranCanvasElement == null) {
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

        logger.info("TranQueryController.renderChartByMonth: values=" + JSON.stringify(values));

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

        logger.fine("TranQueryController.renderChartByMonth: monthLabels=" + JSON.stringify(monthLabels));
        logger.fine("TranQueryController.renderChartByMonth: values=" + JSON.stringify(values));
        logger.fine("TranQueryController.renderChartByMonth: absPluckValues=" + JSON.stringify(absPluckValues));

        renderChartWithThisData( monthLabels, absPluckValues, barColors );
    };

    /**
     * Render the tran by month bar chart.
     */
    var renderChartByTags = function( trans ) {

        currentRenderChartFunction = renderChartByTags;
        logger.info("TranQueryController.renderChartByTags: ");

        destroyTranChart(tranChart);

        // Safety check.
        if ( trans.length == 0  || tranCanvasElement == null) {
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

        logger.info("TranQueryController.renderChartByTags: values=" + JSON.stringify(tagAmounts));

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
        logger.fine("TranQueryController.renderChartByTags: tagAmountsArray=" + JSON.stringify(tagAmountsArray));

        // Step 5. Create the positive/negative bar colors.
        var barColors = ChartUtils.createBarColors( tagAmountsArray );    // red and green bar colors

        // Step 6. Create the actual values for the chart.
        tagAmountsArray = _.map( tagAmountsArray, function(tagAmount) { return Math.abs(tagAmount); } );   

        renderChartWithThisData( tagLabels, tagAmountsArray, barColors );
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
        logger.fine("TranQueryController.fetchNextPage: $scope.page=" + $scope.page);
        $scope.page += 1;
        fetchTransByPage( $scope.postData, $scope.page, $scope.pageSize )
            .then( appendTrans );
    }

    /**
     * The "all" button ng-click.
     * Fetch all remaining trans .
     */
    var fetchAllRemainingTrans = function() {
        logger.fine("TranQueryController.fetchAllRemainingTrans: $scope.page=" + $scope.page);
        $scope.page += 1;

        $scope.postData.options = TranQueryBuilder.buildOptionsForAllRemainingTrans( $scope.page, $scope.pageSize );

        fetchTrans( $scope.postData )
            .then( appendTrans );
    };

    /**
     * @return promise fulfilled with trans
     */
    var fetchTransByPage = function(postData, page, pageSize) {
        postData.options = TranQueryBuilder.buildOptionsForNextPageOfTrans( page, pageSize );
        return fetchTrans( postData );
    };

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
        if (trans.length < $scope.pageSize) {
            $scope.areAllTransFetched = true;
        }

        logger.info("TranQueryController.appendTrans: areAllTransFetched=" + $scope.areAllTransFetched);
        return $scope.trans;
    };

    /**
     * @return promise, fullfilled with tran data.
     */
    var fetchTrans = function(postData) {
        $scope.isThinking = true;
        return Datastore.fetchTrans( postData );
    };

    /**
     * Fetch amounts and tags from all trans (not just a single page),
     * for chart data and full summaries.
     *
     * @return promise fullfilled with all trans
     */
    var fetchTranAmountsAndTags = function(postData) {
        postData.options = TranQueryBuilder.buildOptionsForAmountsAndTags();
        $scope.isChartThinking = true;
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
        $scope.postData.query = TranQueryBuilder.buildQuery($scope);

        reloadTrans();
    };

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
     * Fetch trans for the updated query.
     */
    var reloadTrans = function() {

        fetchTransSummary($scope.postData);     // TODO: can roll this into fetchTranAmountsAndTags

        fetchTranAmountsAndTags( _.extend( {}, $scope.postData) )
                 .then( setChartTrans )
                 .then( renderChart );

        fetchTransByPage( $scope.postData, $scope.page, $scope.pageSize )
                 // Append trans to scope.
                 .then( appendTrans );
    };


    /**
     * We must be embedded in the account.html page.
     * Fetch the account trans.
     */
    var forAccountPage = function( accountId ) {
        logger.info("TranQueryController.forAccountPage: accountId=" + accountId );
        Datastore.fetchAccount( accountId )
                 .then( function success(account) { 
                            $scope.postData.query = TranQueryBuilder.buildQueryForAccount(account); 
                            reloadTrans();
                        });
    };

    /**
     * We must be embedded in the trans.html page.
     * Fetch all trans.
     */
    var forTransPage = function() {
        reloadTrans();
    };

    /**
     * Called from the view.
     * Called when the user hits 'enter' after typing in a tag in the "Tags Inclusion Filter".
     * Add the tag to tagsFilter
     */
    var addTag = function() {
        logger.info("TranQueryController.addTag: " + $scope.inputTagFilter);
        var tag = $scope.inputTagFilter;

        // Clear the input field.
        $scope.inputTagFilter = "";

        if (MiscUtils.isEmpty(tag)) {
            return;
        }

        if ( ! _.contains($scope.tagsFilter, tag) ) {
            $scope.tagsFilter.push(tag);
            logger.info("TranQueryController.addTag: $scope.tagsFilter=" + JSON.stringify($scope.tagsFilter));
        }
    };

    /**
     * Called from the view.
     * Called when the user hits 'enter' after typing in a tag in the "Tags Exclusion Filter".
     * Add the tag to tagsExcludeFilter
     */
    var addTagExclude = function() {
        logger.info("TranQueryController.addTagExclude: " + $scope.inputTagExcludeFilter);
        var tag = $scope.inputTagExcludeFilter;

        // Clear the input field.
        $scope.inputTagExcludeFilter = "";

        if (MiscUtils.isEmpty(tag)) {
            return;
        }

        if ( ! _.contains($scope.tagsExcludeFilter, tag) ) {
            $scope.tagsExcludeFilter.push(tag);
            logger.info("TranQueryController.addTagExclude: $scope.tagsExcludeFilter=" + JSON.stringify($scope.tagsExcludeFilter));
        }
    };

    /**
     * Called from the view.
     * Remove the tag from the tagsFilter list
     */
    var removeTag = function(tag) {
        $scope.tagsFilter = _.filter( $scope.tagsFilter, function(t) { return t != tag; } );
        logger.info("TranQueryController.removeTag: " + tag + ", $scope.tagsFilter=" + JSON.stringify($scope.tagsFilter) );
    };

    /**
     * Called from the view.
     * Remove the tag from the tagsExludeFilter list
     */
    var removeTagExclude = function(tag) {
        $scope.tagsExcludeFilter = _.filter( $scope.tagsExcludeFilter, function(t) { return t != tag; } );
        logger.info("TranQueryController.removeTagExclude: " + tag + ", $scope.tagsExcludeFilter=" + JSON.stringify($scope.tagsExcludeFilter) );
    };

    /**
     * Event hanlder for "$loadSavedQuery" event.
     *
     * @sideeffect update $scope.postData and reload trans.
     *
     */
    var onLoadSavedQuery = function(theEvent, savedQuery) {
        logger.info("TranQueryController.onLoadSavedQuery: savedQuery=" + JSON.stringify(savedQuery));

        resetTranList();
        $scope.postData.query = savedQuery.query;

        // Reset all form data before parsing the query.
        $scope.startDate = null;
        $scope.endDate = null;
        $scope.tagsFilter = [];
        $scope.tagsExcludeFilter = [];
        $scope.inputMerchant = "";

        // parse the query and fill in the form with the query parms
        $scope = _.extend( $scope, TranQueryBuilder.parseQuery( savedQuery.query ) );

        logger.info("TranQueryController.onLoadSavedQuery: after parse: " 
                            + "$scope.startDate=" + $scope.startDate
                            + ", $scope.endDate=" + $scope.endDate
                            + ", $scope.tagsFilter=" + JSON.stringify($scope.tagsFilter)
                            + ", $scope.tagsExcludeFilter=" + JSON.stringify($scope.tagsExcludeFilter) );

        reloadTrans();
    };

    $scope.$on("$loadSavedQuery", onLoadSavedQuery);

    /**
     * Listens for $addTranTag events.
     */
    var onAddTranTag = function(theEvent, tag) {
        logger.info("TranQueryController.onAddTranTag: tag=" + tag + ", $scope.tags=" + JSON.stringify($scope.tags));

        if ( ! _.contains($scope.tags, tag) ) {
            $scope.tags.push(tag);
        }
    };

    $scope.$on("$addTranTag", onAddTranTag );

    /**
     * Export to scope.
     */
    $scope.addTag = addTag;
    $scope.removeTag = removeTag;
    $scope.tagsFilter = [];

    $scope.addTagExclude = addTagExclude;
    $scope.removeTagExclude = removeTagExclude;
    $scope.tagsExcludeFilter = [];

    $scope.startDate = null;
    $scope.endDate = null;
    $scope.postData = {};
    $scope.MiscUtils = MiscUtils;

    /**
     * Init data
     */
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
    $scope.renderChartByTime = renderChartByTime;
    $scope.renderChartByTags = renderChartByTags;

    $scope.isThinking = true;
    $scope.isChartThinking = true;

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
 * For building and parsing tran queries.
 */
.factory( "TranQueryBuilder", [ "Logger", "_", "MiscUtils", "Datastore", 
                        function(Logger,   _,   MiscUtils,   Datastore ) {

    var logger = Logger.getLogger("TranQueryBuilder" , { all: true });

    /**
     * Build a query object based on all form data.
     * 
     * @param $scope contains query data:
     *          startDate,
     *          endDate,
     *          tagsFilter,
     *          tagsExcludeFilter
     *
     * @return the query object, always of the form:
     *         { $and: [ {date-query}, {tags-query} ] }
     *         date-query or tags-query may be empty objects (which is fine)
     */
    var buildQuery = function( $scope ) {

        logger.fine("buildQuery: parms=" + JSON.stringify( _.pick($scope, "startDate", "endDate", "tagsFilter", "tagsExcludeFilter", "inputMerchant" ) ) );

        var dateQuery = buildDateQuery( $scope.startDate, $scope.endDate );
        var tagsQuery = buildTagsQuery( $scope.tagsFilter, $scope.tagsExcludeFilter );  
        var merchantQuery = buildMerchantQuery( $scope.inputMerchant );

        var retMe = { "$and": [ dateQuery, tagsQuery, merchantQuery ] };

        logger.fine("buildQuery: retMe=" + JSON.stringify(retMe) );

        return retMe;
    };

    /**
     *
     * @return a query clause of the form:
     *         { "merchant": { "$regex": ".*amazon.*", "$options": "i" } }
     *         or {}
     */
    var buildMerchantQuery = function( inputMerchant ) {
        logger.fine("buildMerchantQuery: inputMerchant=" + inputMerchant  );

        if (MiscUtils.isEmpty(inputMerchant)) {
            return {};
        }

        var retMe = {   "merchant": { 
                          "$regex": ".*" + inputMerchant + ".*",
                          "$options": "i" 
                        }
                    };
        logger.fine("buildMerchantQuery: retMe=" + JSON.stringify(retMe));
        return retMe;
    }

    /**
     *
     * @return { "inputMerchant": "..." }
     *         or {}
     */
    var parseMerchantQuery = function(merchantQuery) {
        logger.fine("parseMerchantQuery: merchantQuery=" + JSON.stringify(merchantQuery) );

        if (MiscUtils.isNothing(merchantQuery) || MiscUtils.isNothing(merchantQuery.merchant) ) {
            return {};
        }

        var regex = merchantQuery.merchant["$regex"];
        var retMe = { "inputMerchant": regex.substring(2, regex.length - 2) };
        logger.fine("parseMerchantQuery: retMe=" + JSON.stringify(retMe));
        return retMe;
    };

    /**
     *
     * @return a query clause of the form:
     *         { "timestamp": { "$gte": startDate-timestamp, "$lte": endDate-timestamp } }.
     *         If either startDate or endDate are null they're omitted.
     */
    var buildDateQuery = function(startDate, endDate) {

        logger.fine("buildDateQuery: startDate=" + startDate + ", endDate=" + endDate);

        var query = {};

        if (startDate != null) {
            query.timestamp = query.timestamp || {};
            query.timestamp["$gte"] = startDate.getTime() / 1000;
        }

        if (endDate != null) {
            query.timestamp = query.timestamp || {};
            query.timestamp["$lte"] = endDate.getTime() / 1000;
        }

        logger.fine("buildDateQuery: retMe=" + JSON.stringify(query) );

        return query;
    };

    /**
     *
     * @return query phrase of the form     
     *         { $or: [ { tags: "dining" }, {tags: "socializing"} ] }
     */
    var buildTagsInclusionQuery = function(tagsFilter) {

        logger.fine("buildTagsInclusionQuery: tagsFilter=" + JSON.stringify(tagsFilter)  );

        if ( MiscUtils.isNothing(tagsFilter) || tagsFilter.length == 0 ) {
            return {};
        }

        // end up with something like:
        // { $or: [ { tags: "dining" }, {tags: "socializing"} ] }
        var tagsInclusionQuery = { "$or": _.map( tagsFilter, function(tag) { return { "tags": tag }; } ) } ;

        logger.fine("buildTagsInclusionQuery: retMe=" + JSON.stringify(tagsInclusionQuery)  );

        return tagsInclusionQuery;
    };

    /**
     *
     * @return query phrase of the form     
     *         { $and: [ { tags: { "$ne": "dining" } }, {tags: { "$ne": "socializing" } } ] }
     */
    var buildTagsExclusionQuery = function(tags) {

        logger.fine("buildTagsExclusionQuery: tags=" + JSON.stringify(tags)  );

        if ( MiscUtils.isNothing(tags) || tags.length == 0 ) {
            return {};
        }

        // end up with something like:
        // { $and: [ { tags: { "$ne": "dining" } }, {tags: { "$ne": "socializing" } } ] }
        var tagsExclusionQuery = { "$and": _.map( tags, function(tag) { return { "tags": { "$ne": tag } }; } ) } ;

        logger.fine("buildTagsExclusionQuery: retMe=" + JSON.stringify(tagsExclusionQuery)  );

        return tagsExclusionQuery;
    };

    /**
     *
     * @return a query object for the given tags.
     *         always of the form: { $and: [ {tag-inclusion}, {tag-exclusion} ] }
     *         tag-inclusion or tag-exclusion may be empty objects, which is fine.
     */
    var buildTagsQuery = function( tagsFilter, tagsExcludeFilter ) {   

        logger.fine("buildTagsQuery: entry");

        var retMe = { "$and": [ buildTagsInclusionQuery( tagsFilter ), 
                                buildTagsExclusionQuery( tagsExcludeFilter ) ] };

        logger.fine("buildTagsQuery: retMe=" + JSON.stringify(retMe) );

        return retMe;
    };

    /**
     * Parse the timestamp query
     *
     * { "timestamp": { "$gte": startDate-timestamp, "$lte": endDate-timestamp } }
     *
     * @return { startDate: Date(), endDate: Date() }
     *         or {}
     */
    var parseTimestampQuery = function(timestampQuery) {

        logger.fine("parseTimestampQuery: timestampQuery=" + JSON.stringify(timestampQuery));

        if ( MiscUtils.isNothing( timestampQuery ) ) {
            return {};
        }

        var retMe = {};
        retMe.startDate = ( angular.isDefined( timestampQuery["$gte"] ) ) 
                                        ? new Date( timestampQuery["$gte"] * 1000)
                                        : null;

        retMe.endDate = ( angular.isDefined( timestampQuery["$lte"] ) ) 
                                        ? new Date( timestampQuery["$lte"] * 1000)
                                        : null;

        logger.fine("parseTimestampQuery: retMe=" + JSON.stringify(retMe));
        return retMe;
    };

    /**
     * 
     * Parse the date query (built via buildDateQuery)
     *
     * {date-query}:
     *      {}
     *      { "timestamp": { "$gte": startDate-timestamp } }
     *      { "timestamp": { "$gte": startDate-timestamp, "$lte": endDate-timestamp } }
     *
     * @return { startDate: Date(), endDate: Date() } 
     *         or {}
     */
    var parseDateQuery = function(dateQuery) {

        logger.fine("parseDateQuery: dateQuery=" + JSON.stringify(dateQuery));

        if (MiscUtils.isNothing( dateQuery ) ) {
            return {};
        }

        var retMe = parseTimestampQuery( dateQuery["timestamp"] );
        logger.fine("parseDateQuery: retMe=" + JSON.stringify(retMe));
        return retMe;
    };

    /**
     * Parse the tags inclusion query:
     *
     * {tags-query}:
     *      { $and: [ {tag-inclusion}, {tag-exclusion} ] }
     *
     * {tag-inclusion}:
     *      { $or: [ { "tags": "dining" }, { "tags": "socializing" } ] }
     *
     * @return list of tags from the inclusion query
     */
    var parseTagsInclusionQuery = function(tagsInclusionQuery) {

        logger.fine("parseTagsInclusionQuery: tagsInclusionQuery=" + JSON.stringify(tagsInclusionQuery) );

        if ( MiscUtils.isNothing( tagsInclusionQuery ) || MiscUtils.isNothing(tagsInclusionQuery["$or"]) ) {
            return;
        }

        var retMe = _.pluck( tagsInclusionQuery["$or"], "tags" );
        logger.fine("parseTagsInclusionQuery: retMe=" + JSON.stringify(retMe) );
        return retMe;
    };

    /**
     * Parse the tags exclusion query:
     *
     * {tags-query}:
     *      { $and: [ {tag-inclusion}, {tag-exclusion} ] }
     *
     * {tag-exclusion}:
     *      { $and: [ { "tags": { "$ne": "dining" } } ] }
     *
     * @return list of tags from the exclusion query
     */
    var parseTagsExclusionQuery = function(tagsExclusionQuery) {

        logger.fine("parseTagsExclusionQuery: tagsExclusionQuery=" + JSON.stringify(tagsExclusionQuery) );

        if ( MiscUtils.isNothing( tagsExclusionQuery ) || MiscUtils.isNothing(tagsExclusionQuery["$and"]) ) {
            return;
        }

        var retMe = _.pluck( _.pluck( tagsExclusionQuery["$and"], "tags" ), "$ne" );
        logger.fine("parseTagsExclusionQuery: retMe=" + JSON.stringify(retMe) );
        return retMe;
    };

    /**
     * 
     * Parse the tags query (built via buildTagsQuery)
     *
     * {tags-query}:
     *      { $and: [ {tag-inclusion}, {tag-exclusion} ] }
     *
     * {tag-inclusion}:
     *      { $or: [ { "tags": "dining" }, { "tags": "socializing" } ] }
     *
     * {tag-exclusion}:
     *      { $and: [ { "tags": { "$ne": "dining" } } ] }
     *
     *
     * @return { tagsFilter: [], tagsExcludeFilter: [] }
     *         or {}
     */
    var parseTagsQuery = function(tagsQuery) {

        logger.fine("parseTagsQuery: tagsQuery=" + JSON.stringify(tagsQuery));

        if ( MiscUtils.isNothing( tagsQuery ) || MiscUtils.isNothing(tagsQuery["$and"]) ) {
            return {};
        }

        var tagsInclusionQuery = tagsQuery["$and"][0];
        var tagsExclusionQuery = tagsQuery["$and"][1];

        var retMe = {};
        retMe.tagsFilter = parseTagsInclusionQuery( tagsInclusionQuery );
        retMe.tagsExcludeFilter = parseTagsExclusionQuery( tagsExclusionQuery );

        logger.fine("parseTagsQuery: retMe=" + JSON.stringify(retMe));
        return retMe;
    };

    /**
     *
     * Parse the query and fill in the form with the query parms
     *
     * All saved queries are of the form:
     *      { $and: [ {date-query}, {tags-query}, {merchant-query} ] }
     *
     * @return { 
     *              startDate: Date(), 
     *              endDate: Date(),
     *              tagsFilter: [], 
     *              tagsExcludeFilter: [] ,
     *              inputMerchant: "xx"
     *         }
     *         or {}
     *
     */
    var parseQuery = function(query) {

        logger.fine("parseQuery: query=" + JSON.stringify(query));

        if ( MiscUtils.isNothing( query ) || MiscUtils.isNothing(query["$and"]) ) {
            return {};
        }

        var dateQuery = query["$and"][0];
        var tagsQuery = query["$and"][1] || null;
        var merchantQuery = query["$and"][2] || null;

        var retMe = _.extend( {}, 
                              parseDateQuery( dateQuery ), 
                              parseTagsQuery( tagsQuery ),
                              parseMerchantQuery( merchantQuery ) );

        logger.fine("parseQuery: retMe=" + JSON.stringify(retMe));
        return retMe;
    };

    /**
     * @return an options object to apply to a query that fetches
     *         all the remaining trans.
     */
    var buildOptionsForAllRemainingTrans = function( page, pageSize ) {
        return { "sort": { "timestamp": -1 },
                 "skip": page * pageSize,
                 "fields": Datastore.getTranFieldProjection()
               } ;
    };

    /**
     * @return an options object to apply to a query that fetches
     *         the next page of trans
     */
    var buildOptionsForNextPageOfTrans = function( page, pageSize ) {
        return { "sort": { "timestamp": -1 },
                 "limit": pageSize,
                 "skip": page * pageSize,
                 "fields": Datastore.getTranFieldProjection()
               } ;
    };

    /**
     * @return an options object to apply to a query that fetches
     *         all trans but only certain fails.
     */
    var buildOptionsForAmountsAndTags = function() {
        return { "sort": { "timestamp": -1 },
                 "fields": { "amountValue": 1,
                             "timestamp": 1,
                             "tags": 1
                           }
               } ;
    };

    /**
     * @return query data for the given account
     */
    var buildQueryForAccount = function( account ) {
        logger.fine("buildQueryForAccount: account=" + JSON.stringify( _.pick( account, "accountName", "fiName") ));
        return {   "account": account.accountName,
                   "fi": account.fiName };
    };

    return {
        buildQuery: buildQuery,
        parseQuery: parseQuery,
        buildOptionsForAmountsAndTags,
        buildOptionsForNextPageOfTrans,
        buildOptionsForAllRemainingTrans,
        buildQueryForAccount: buildQueryForAccount
    };

}])


/**
 * Mongo datastore.
 */
.factory("Datastore", [ "$http", "Logger",
               function( $http,   Logger ) {

    var logger = Logger.getLogger("Datastore", { all: false });

    /**
     * Fetch the list of tags from the db.
     *
     * @return promise, fulfilled with tags list
     */
    var fetchTags = function() {
        logger.info("Datastore.fetchTags: ");
        return $http.get( "/tags" )
                    .then( function success(response) {
                               // response.data – {string|Object} – The response body transformed with the transform functions.
                               // response.status – {number} – HTTP status code of the response.
                               // response.headers – {function([headerName])} – Header getter function.
                               // resposne.config – {Object} – The configuration object that was used to generate the request.
                               // response.statusText – {string} – HTTP status text of the response.
                               logger.fine( "Datastore.fetchTags: response=" + JSON.stringify(response,null,2));
                               return response.data ;
                           }, function error(response) {
                               logger.severe("Datastore.fetchTags: GET /tags: response=" + JSON.stringify(response)); 
                           } );
    };

    /**
     * fetch account info from db
     *
     * @return promise, fulfilled by the account record.
     */
    var fetchAccount = function( accountId ) {
        logger.info("Datastore.fetchAccount: accountId=" + accountId);

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
                               logger.fine( "Datastore.fetchAccount: /accounts/" + accountId + ": response=" + JSON.stringify(response));
                               return response.data;
                           }, 
                           function error(response) {
                               logger.severe("Datastore.fetchAccount: GET /account/" + accountId + ": response=" + JSON.stringify(response)); 
                           });
    };

    /**
     * @return promise, fulfilled by the accountTimeSeries records.
     */
    var fetchAccountTimeSeries = function( accountId ) {
        logger.info("Datastore.fetchAccountTimeSeries: accountId=" + accountId);
        return $http.get( "/accounts/" + accountId + "/timeseries")
                    .then( function success(response) {
                               logger.fine( "Datastore.fetchAccountTimeSeries: /accounts/" + accountId + "/timeseries: response=" + JSON.stringify(response));
                               return response.data;
                           }, 
                           function error(response) {
                               logger.severe("Datastore.fetchAccountTimeSeries: GET /account/" + accountId + "/timeseries: response=" + JSON.stringify(response)); 
                           });
    };

    /**
     * @return promise, fulfilled by the account's tran records.
     */
    var fetchAccountTrans = function( accountId ) {
        logger.info("Datastore.fetchAccountTrans: accountId=" + accountId);
        return $http.get( "/accounts/" + accountId + "/transactions")
                    .then( function success(response) {
                               logger.info( "Datastore.fetchAccountTrans: /accounts/" + accountId + "/transactions: length=" + response.data.length );
                               logger.fine( "Datastore.fetchAccountTrans: /accounts/" + accountId + "/transactions: response=" + JSON.stringify(response));
                               return response.data;
                           }, 
                           function error(response) {
                               logger.severe("Datastore.fetchAccountTrans: GET /account/" + accountId + "/transactions: response=" + JSON.stringify(response)); 
                           });
    };

    /**
     * TODO: use this.
     * @return the typical account fields to fetch
     */
    var getAccountFieldProjection = function() {
        return [  "accountType",
                  "currentBalance",
                  "value",
                  "accountId",
                  "fiName",
                  "accountName",
                  "dueAmt",
                  "dueDate",
                  "last7days",
                  "last30days",
                  "last90days",
                  "last365days",
                  "fiLastUpdated"
               ];
    };

    /**
     * fetch accounts from db 
     *
     * @return promise
     */
    var fetchAccounts = function() {
        logger.info("Datastore.fetchAccounts:");
        return $http.get( "/accounts" )
                    .then( function success(response) {
                               logger.fine( "Datastore.fetchAccounts: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               logger.severe("Datastore.fetchAccounts: GET /accounts: response=" + JSON.stringify(response)); 
                           } );
    };

    /**
     * fetch accounts with isActive=true from db 
     *
     * @return promise
     */
    var fetchActiveAccounts = function() {
        logger.info("Datastore.fetchActiveAccounts:");
        var postData = { "query": { "isActive": true },
                         "options": { "sort": { "fiName": 1 },
                                      "fields": getAccountFieldProjection() 
                                    } 
                       };

        return $http.post( "/query/accounts", postData )
                    .then( function success(response) {
                               logger.fine( "Datastore.fetchActiveAccounts: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               logger.severe("Datastore.fetchActiveAccounts: POST /query/accounts: response=" + JSON.stringify(response)); 
                           } );
    };
    
    /**
     * fetch new (i.e. hasBeenAcked=false) trans from the db 
     *
     * @return promise
     */
    var fetchNewTrans = function() {
        logger.info("Datastore.fetchNewTrans:");
        var postData = { "query": { "$or": [ { "hasBeenAcked": { "$exists": false } }, 
                                             { "hasBeenAcked" : false } 
                                           ] 
                                  },
                         "options": { "sort": { "timestamp": -1 },
                                      "fields": getTranFieldProjection() 
                                    } 
                       };
        return fetchTrans( postData );
    };

    /**
     * @return the typical tran fields to fetch.
     */
    var getTranFieldProjection = function() {
        return [ "_id",
                 "date", 
                 "isDebit",
                 "isPending",
                 "isTransfer",
                 "amount",
                 "amountValue",
                 "merchant",
                 "omerchant",
                 "account",
                 "tags",
                 "pendingTran"];
    };

    /**
     * fetch trans
     *
     * @return promise
     */
    var fetchTrans = function( postData ) {
        logger.info("Datastore.fetchTrans: postData=" + JSON.stringify(postData) );
        return $http.post( "/query/transactions", postData )
                    .then( function success(response) {
                               logger.info( "Datastore.fetchTrans: response.length=" + response.data.length);
                               logger.fine( "Datastore.fetchTrans: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               logger.severe("Datastore.fetchTrans: POST /query/transactions"
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
        logger.info("Datastore.fetchTransCount: postData=" + JSON.stringify(postData) );
        return $http.post( "/query/transactions/count", postData )
                    .then( function success(response) {
                               logger.fine( "Datastore.fetchTrans: response=" + JSON.stringify(response,null,2));
                               return response.data[0];
                           }, function error(response) {
                               logger.severe("Datastore.fetchTrans: POST /query/transactions/count"
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
        logger.info("Datastore.fetchTransSummary: postData=" + JSON.stringify(postData) );
        return $http.post( "/query/transactions/summary", postData )
                    .then( function success(response) {
                               logger.fine( "Datastore.fetchTransSummary: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               logger.severe("Datastore.fetchTranSummary: POST /query/transactions/summary"
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

        logger.info("Datastore.putTran: tranId=" + tranId + ", putData=" + JSON.stringify(putData));

        return $http.put( "/transactions/" + tranId, putData )
                    .then( function success(response) {
                               logger.fine( "Datastore.putTran: response=" + JSON.stringify(response,null,2));
                           }, function error(response) {
                               logger.severe("Datastore.putTran: PUT /transactions/" + tranId + ": response=" + JSON.stringify(response)); 
                           } );
    };

    /**
     * GET /savedqueries
     *
     * @return promise
     */
    var fetchSavedQueries = function() {
        logger.info("Datastore.fetchSavedQueries: ");

        return $http.get( "/savedqueries" )
                    .then( function success(response) {
                               logger.fine( "Datastore.fetchSavedQueries: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               logger.severe("Datastore.fetchSavedQueries: GET /savedqueries: response=" + JSON.stringify(response)); 
                           } );
    };

    /**
     * POST /savedqueries {savedQuery}
     * @return promise
     */
    var saveQuery = function(savedQuery) {
        logger.info("Datastore.saveQuery: savedQuery=" + JSON.stringify(savedQuery) );
        return $http.post( "/savedqueries", savedQuery)
                    .then( function success(response) {
                               logger.fine( "Datastore.saveQuery: response=" + JSON.stringify(response,null,2));
                           }, function error(response) {
                               logger.severe("Datastore.saveQuery: POST /savedqueries: postData=" + JSON.stringify(savedQuery)
                                                                      + "response=" + JSON.stringify(response)); 
                           } );
    };

    /**
     * export
     */
    return {
        getTranFieldProjection: getTranFieldProjection,
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
 * Put various stuff in here until better homes can be found.
 */
.factory( "MiscUtils", [ "Logger", 
                 function(Logger) {

    var logger = Logger.getLogger("MiscUtils");

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
        logger.fine("MiscUtils.sumField: fieldName=" + fieldName + ": " + retMe);
        return retMe;
    };

    /**
     * @return true if the given string is null or empty
     */
    var isEmpty = function(s) {
        return angular.isUndefined(s) || !s || s.trim().length == 0;
    };

    /**
     * @return true if the parm is defined
     */
    var isDefined = function(x) {
        return angular.isDefined(x);
    };

    /**
     * @return true if the given x is undefined or null.
     */
    var isNothing = function(x) {
        return angular.isUndefined(x) || x == null;
    };

    return {
        currencyToNumber: currencyToNumber,
        sumField: sumField,
        isEmpty: isEmpty,
        isDefined: isDefined,
        isNothing: isNothing
    };
}])


/**
 * Chart utils.
 */
.factory( "ChartUtils", [ "Logger", 
                  function(Logger) {

    var logger = Logger.getLogger("ChartUtils");

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
     *         Note: the first and last element are always copied over.
     */
    var sampleEveryNthAndReplace = function( arr, everyNth, replaceValue) {
        var retMe = new Array(arr.length);
        for (var i=0; i < arr.length; ++i) {
            if (i % everyNth == 0 || i == arr.length-1) {
                retMe[i] = arr[i];
            } else {
                retMe[i] = replaceValue;
            }
        }
        return retMe;
    };

    /**
     * @return a new array containing everyNth element from the given array.
     *         Note: the first and last element are always included.
     */
    var sampleEveryNth = function( arr, everyNth) {
        var retMe = [];
        for (var i=0; i < arr.length; ++i) {
            // always include the last element
            if (i % everyNth == 0 || i == arr.length-1) {
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
        logger.info("ChartUtils.createBarColors: values.length=" + (values || []).length);
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
        logger.info("ChartUtils.setBarColors: chart updated");
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

    var logger = Logger.getLogger( "DateUtils", { all: false } );

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
    
    /**
     * Angular dateFilter formats: https://github.com/angular/angular.js/blob/dc57fe97e1be245fa08f25143302ee9dd850c5c9/src/ng/filter/filters.js#L310
     * @return e.g: "1/5/16"
     */
    var formatDateLabel = function( d ) {
        return dateFilter(d, "M/d/yy");
        // return d.toLocaleFormat('%m.%d.%y');
    };

    /**
     * Angular dateFilter formats: https://github.com/angular/angular.js/blob/dc57fe97e1be245fa08f25143302ee9dd850c5c9/src/ng/filter/filters.js#L310
     * @return e.g: "Jan 2016"
     */
    var formatMonthLabel = function(d) {
        var monthLabel = dateFilter(d, "MMM yyyy");
        logger.fine("DateUtils.formatMonthLabel: " + monthLabel );
        return monthLabel;
    }

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
     * @param fromDate
     * @param toDate
     *
     * @return an array of date labels between fromDate and toDate
     */
    var createDateLabels = function( fromDate, toDate ) {

        var daysBetween = dateDiff('d', fromDate, toDate);

        logger.info("DateUtils.createDateLabels: fromDate=" + formatDateLabel(fromDate) 
                                            + ", toDate=" + formatDateLabel(toDate) 
                                            + ", daysBetween=" + daysBetween );

        var retMe = new Array(daysBetween);

        for (var i=0; i <= daysBetween; ++i) {
            retMe[i] = formatDateLabel( fromDate );
            fromDate.setDate( fromDate.getDate() + 1);
        }

        logger.info("DateUtils.createDateLabels: retMe=" + JSON.stringify(retMe));
        return retMe;

    };

    /**
     * @param fromDate
     * @param toDate
     *
     * @return an array of month labels between fromDate and toDate
     */
    var createMonthLabels = function( fromDate, toDate ) {

        logger.info("DateUtils.createMonthLabels: fromDate=" + formatDateLabel(fromDate) 
                                             + ", toDate=" + formatDateLabel(toDate)  );

        var retMe = [];

        var currDate = fromDate;
        currDate.setDate(1);

        var i=0;    // trying to avoid infinite loops.
        for ( ;
              currDate <= toDate ;
              currDate.setMonth( currDate.getMonth() + 1 ) && ++i < 1000) {
            logger.fine("DateUtils.createMonthLabel: currDate=" + formatDateLabel(currDate) );
            retMe.push( formatMonthLabel( currDate ) );
        }

        logger.info("DateUtils.createMonthLabels: retMe=" + JSON.stringify(retMe));
        return retMe;
    };


    return {
        createDateLabels: createDateLabels,
        createMonthLabels: createMonthLabels,
        formatMonthLabel: formatMonthLabel,
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

