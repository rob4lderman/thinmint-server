angular.module( "tmFactories", [] )

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
 * For building and parsing tran queries.
 */
.factory( "TranQueryBuilder", [ "Logger", "_", "MiscUtils", "Datastore", 
                        function(Logger,   _,   MiscUtils,   Datastore ) {

    var logger = Logger.getLogger("TranQueryBuilder" , { all: false });

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
            return [];
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
            return [];
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
.factory("Datastore", [ "$http", "Logger", "_", "$rootScope", "MiscUtils", 
               function( $http,   Logger,   _,   $rootScope,   MiscUtils) {

    var logger = Logger.getLogger("Datastore", { all: false });

    /**
     * Fetch the list of tags from the db.
     *
     * @return promise, fulfilled with tags list
     */
    var fetchTags = function() {
        logger.info("fetchTags: ");
        return $http.get( "/tags" )
                    .then( function success(response) {
                               // response.data – {string|Object} – The response body transformed with the transform functions.
                               // response.status – {number} – HTTP status code of the response.
                               // response.headers – {function([headerName])} – Header getter function.
                               // resposne.config – {Object} – The configuration object that was used to generate the request.
                               // response.statusText – {string} – HTTP status text of the response.
                               logger.fine( "fetchTags: response=" + JSON.stringify(response,null,2));
                               return response.data ;
                           }, function error(response) {
                               logger.severe("fetchTags: GET /tags: response=" + JSON.stringify(response)); 
                           } );
    };

    /**
     * fetch account info from db
     *
     * @return promise, fulfilled by the account record.
     */
    var fetchAccount = function( accountId ) {
        logger.info("fetchAccount: accountId=" + accountId);

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
                               logger.fine( "fetchAccount: /accounts/" + accountId + ": response=" + JSON.stringify(response));

                               logger.fine("fetchAccount: $rootScope.$broadcast($tmAccountLoaded)");
                               $rootScope.$broadcast( "$tmAccountLoaded", response.data );
                               return response.data;
                           }, 
                           function error(response) {
                               logger.severe("fetchAccount: GET /account/" + accountId + ": response=" + JSON.stringify(response)); 
                           });
    };

    /**
     * @return promise, fulfilled by the accountTimeSeries records.
     */
    var fetchAccountTimeSeries = function( accountId ) {
        logger.info("fetchAccountTimeSeries: accountId=" + accountId);
        return $http.get( "/accounts/" + accountId + "/timeseries")
                    .then( function success(response) {
                               logger.fine( "fetchAccountTimeSeries: /accounts/" + accountId + "/timeseries: response=" + JSON.stringify(response));
                               return response.data;
                           }, 
                           function error(response) {
                               logger.severe("fetchAccountTimeSeries: GET /account/" + accountId + "/timeseries: response=" + JSON.stringify(response)); 
                           });
    };

    /**
     * @return promise, fulfilled by the account's tran records.
     */
    var fetchAccountTrans = function( accountId ) {
        logger.info("fetchAccountTrans: accountId=" + accountId);
        return $http.get( "/accounts/" + accountId + "/transactions")
                    .then( function success(response) {
                               logger.info( "fetchAccountTrans: /accounts/" + accountId + "/transactions: length=" + response.data.length );
                               logger.fine( "fetchAccountTrans: /accounts/" + accountId + "/transactions: response=" + JSON.stringify(response));
                               return response.data;
                           }, 
                           function error(response) {
                               logger.severe("fetchAccountTrans: GET /account/" + accountId + "/transactions: response=" + JSON.stringify(response)); 
                           });
    };

    /**
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
        logger.info("fetchAccounts:");
        return $http.get( "/accounts" )
                    .then( function success(response) {
                               logger.fine( "fetchAccounts: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               logger.severe("fetchAccounts: GET /accounts: response=" + JSON.stringify(response)); 
                           } );
    };

    /**
     * fetch accounts with isActive=true from db 
     *
     * @return promise
     */
    var fetchActiveAccounts = function() {
        logger.info("fetchActiveAccounts:");
        var postData = { "query": { "isActive": true,
                                    "mintMarker": 1 
                                  },
                         "options": { "sort": { "fiName": 1, "accountName": 1 },
                                      "fields": getAccountFieldProjection() 
                                    } 
                       };
        return queryAccounts(postData);
    };

    /**
     * fetch accounts from db 
     *
     * @return promise
     */
    var queryAccounts = function(postData) {
        postData.query = _.extend( { "mintMarker": 1 }, postData.query );
        logger.info("queryAccounts: postData=" + JSON.stringify(postData));

        return $http.post( "/query/accounts", postData )
                    .then( function success(response) {
                               logger.fine( "queryAccounts: response=" + JSON.stringify(response,null,2));
                               MiscUtils.$broadcast( "$tmAccountsLoaded", response.data );
                               return response.data;
                           }, function error(response) {
                               logger.severe("queryAccounts: POST /query/accounts: response=" + JSON.stringify(response)); 
                           } );
    };
    
    /**
     * fetch new (i.e. hasBeenAcked=false) trans from the db 
     *
     * @return promise
     */
    var fetchNewTrans = function() {
        logger.info("fetchNewTrans:");
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
        postData.query = _.extend( { "mintMarker": 1 }, postData.query );
        logger.info("fetchTrans: postData=" + JSON.stringify(postData) );
        return $http.post( "/query/transactions", postData )
                    .then( function success(response) {
                               logger.info( "fetchTrans: response.length=" + response.data.length);
                               logger.fine( "fetchTrans: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               logger.severe("fetchTrans: POST /query/transactions"
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
        postData.query = _.extend( { "mintMarker": 1 }, postData.query );
        logger.info("fetchTransCount: postData=" + JSON.stringify(postData) );
        return $http.post( "/query/transactions/count", postData )
                    .then( function success(response) {
                               logger.fine( "fetchTransCount: response=" + JSON.stringify(response,null,2));
                               return response.data[0];
                           }, function error(response) {
                               logger.severe("fetchTransCount: POST /query/transactions/count"
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
        postData.query = _.extend( { "mintMarker": 1 }, postData.query );
        logger.info("fetchTransSummary: postData=" + JSON.stringify(postData) );
        return $http.post( "/query/transactions/summary", postData )
                    .then( function success(response) {
                               logger.fine( "fetchTransSummary: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               logger.severe("fetchTranSummary: POST /query/transactions/summary"
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
        logger.info("fetchSavedQueries: ");

        return $http.get( "/savedqueries" )
                    .then( function success(response) {
                               logger.fine( "fetchSavedQueries: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               logger.severe("fetchSavedQueries: GET /savedqueries: response=" + JSON.stringify(response)); 
                           } );
    };

    /**
     * GET /savedqueries/{id}
     *
     * @return promise
     */
    var fetchSavedQuery = function(savedQueryId) {
        logger.info("fetchSavedQuery: savedQueryId=" + savedQueryId);

        var url = "/savedqueries/" + savedQueryId ;
        return $http.get( url )
                    .then( function success(response) {
                               logger.fine( "fetchSavedQuery: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               logger.severe("fetchSavedQuery: GET " + url + ": response=" + JSON.stringify(response)); 
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
     * @return promise that is satified with tagsByMonth records
     */
    var queryTagsByMonth = function( postData ) {
        logger.info("queryTagsByMonth: postData=" + JSON.stringify(postData) );
        return $http.post( "/query/tagsbymonth", postData )
                    .then( function success(response) {
                               logger.info( "queryTagsByMonth: response.length=" + response.data.length);
                               logger.fine( "queryTagsByMonth: response=" + JSON.stringify(response,null,2));
                               return response.data;
                           }, function error(response) {
                               logger.severe("queryTagsByMonth: POST /query/tagsByMonth"
                                                                    + ", postData=" + JSON.stringify(postData) 
                                                                    + ", response=" + JSON.stringify(response));
                           } );

    };

    /**
     * export
     */
    return {
        getTranFieldProjection: getTranFieldProjection,
        getAccountFieldProjection: getAccountFieldProjection,
        fetchTags: fetchTags,
        fetchAccount: fetchAccount,
        fetchAccountTrans: fetchAccountTrans,
        fetchAccountTimeSeries: fetchAccountTimeSeries,
        fetchAccounts: fetchAccounts,
        fetchActiveAccounts: fetchActiveAccounts,
        queryTagsByMonth: queryTagsByMonth,
        queryAccounts: queryAccounts,
        fetchNewTrans: fetchNewTrans,
        fetchSavedQueries: fetchSavedQueries,
        fetchSavedQuery: fetchSavedQuery,
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
.factory( "MiscUtils", [ "Logger", "$rootScope", "$timeout", "_",
                 function(Logger,   $rootScope,   $timeout,   _) {

    var logger = Logger.getLogger("MiscUtils", {info:false});

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
        logger.fine("sumField: fieldName=" + fieldName + ": " + retMe);
        return retMe;
    };

    /**
     * @param objs a list of objs that contain the given fields
     * @param fields, e.g.  ["value", "last7days", "last30days", "last90days", "last365days" ]
     *
     * @return an object where the keys are the field names and the values are the sums
     */
    var sumFields = function( objs, fields ) {
        
        logger.fine("sumFields: fields=" + JSON.stringify(fields));

        var retMe = {};

        _.each( fields,
                function(fieldName) {
                    retMe[fieldName] = sumField( objs, fieldName );
                } );

        logger.fine("sumFields: retMe=" + JSON.stringify(retMe));
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

    /**
     * Keep track of fired events.
     * { eventName: eventData, ... }
     */
    var firedEvents = {};

    /**
     * $rootScope.$broadcast(eventName, eventData), wrapped in a $timeout.
     */
    var $broadcast = function(eventName, eventData) {
        logger.info("$broadcast: eventName=" + eventName );
        // Broadcast event 
        // Need to queue it up via $timeout due to scope life-cycle issues.
        // http://stackoverflow.com/questions/15676072/angularjs-broadcast-not-working-on-first-controller-load
        $timeout(function() {
                     logger.fine("$timeout:$broadcast: eventName=" + eventName  + ", eventData=" + JSON.stringify(eventData) );
                     $rootScope.$broadcast( eventName, eventData );
                 }, 1);

        // Keep track of the event for any late-loaded controllers (e.g. from a partial) that might be interested in it.
        firedEvents[eventName] = eventData;
    };

    /**
     * Registers the callbackFn for the given eventName on the given $scope.
     *
     * If a $broadcast for the event has already been called (registered with firedEvents), then
     * the callbackFn will be invoked (async'ly via $timeout) with the event data.  This is for
     * late-loaded controllers that might have missed the event.
     */
    var $on = function($scope, eventName, callbackFn) {
        $scope.$on(eventName, callbackFn);

        if ( isDefined(firedEvents[eventName]) ) {
            logger.info("$on: the event " + eventName + " may have already fired. Will queue up a call to the callbackFn." );
            logger.fine("$on: eventName=" + eventName + ",eventData=" + JSON.stringify(firedEvents[eventName]) );
            $timeout( _.partial( callbackFn, {}, firedEvents[eventName] ), 
                      1 );
        }
    };

    /**
     * @return a DupEventChecker object, which maintains prevEventData / currEventData state
     *         to detect dup events.
     */
    var getDupEventChecker = function(logger) {
        return { 
            prevEventData: null,
            isDupEvent: function(currEventData) {
                var retMe = (this.prevEventData == currEventData);
                if (retMe) {
                    logger.info( "isDupEvent: " + retMe + ", prevEventData=" + this.prevEventData + ", currEventData=" + currEventData );
                }
                this.prevEventData = currEventData;
                return retMe;
            }
        }
    };

    return {
        currencyToNumber: currencyToNumber,
        sumField: sumField,
        sumFields: sumFields,
        isEmpty: isEmpty,
        isDefined: isDefined,
        isNothing: isNothing,
        "$on": $on,
        "$broadcast": $broadcast,
        getDupEventChecker: getDupEventChecker
    };
}])


/**
 * Chart utils.
 */
.factory( "ChartUtils", [ "Logger", 
                  function(Logger) {

    var logger = Logger.getLogger("ChartUtils", {all: false} );

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
        logger.info("createBarColors: values.length=" + (values || []).length);
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
    var setBarColors = function(theChart, chartDataset, barColors) {
        for (var i=0; i < barColors.length; ++i) {
            chartDataset.bars[i].fillColor = barColors[i];
        }
        theChart.update();
        logger.info("setBarColors: chart updated");
    };

    /**
     * Set the bar colors of the given chart.
     */
    var setBarColorsForAllDatasets = function(theChart, chartData) {

        for (var i=0; i < chartData.datasets.length; ++i) {
            setBarColors( theChart, theChart.datasets[i], chartData.datasets[i].tm.barColors );
        }

        logger.info("setBarColorsForAllDatasets: chart updated");
    };

    /**
     *
     * Render the bar chart with the given data.
     * Also sets bar colors (chartData.datasets[0].tm.barColors)
     *
     * @return the chart object.
     */
    var renderLineChartData = function( canvasElement, chartData ) {

        // Get the context of the canvas element we want to select
        return new Chart(canvasElement.getContext("2d"))
                     .Line(chartData, { responsive: true });
    };

    /**
     *
     * Render the bar chart with the given data.
     * Also sets bar colors (chartData.datasets[0].tm.barColors)
     *
     * @return the chart object.
     */
    var renderBarChartData = function( canvasElement, chartData ) {

        // Get the context of the canvas element we want to select
        var retMe = new Chart(canvasElement.getContext("2d"))
                          .Bar(chartData, { responsive: true });

        setBarColorsForAllDatasets(retMe, chartData);
        return retMe;
    };

    /**
     * Render the chart with the given data.
     *
     * @return the chart object.
     */
    var renderChartData = function( canvasElement, chartData ) {

        logger.fine("renderChartData: canvasElement=" + canvasElement 
                                    + ", chartData.tm=" + JSON.stringify(chartData.tm) );

        if ( _.isUndefined( chartData.tm ) ) {
            return renderBarChartData( canvasElement, chartData );
        } else if ( chartData.tm.type == "Bar" ) {
            return renderBarChartData( canvasElement, chartData );
        } else if ( chartData.tm.type == "Line" ) {
            return renderLineChartData( canvasElement, chartData );
        }

    };


    /**
     * Export
     */
    return {
        sampleEvenlyAndReplace: sampleEvenlyAndReplace,
        sampleEveryNthAndReplace: sampleEveryNthAndReplace,
        sampleEveryNth: sampleEveryNth,
        createBarColors: createBarColors,
        setBarColors: setBarColors,
        setBarColorsForAllDatasets: setBarColorsForAllDatasets,
        renderChartData: renderChartData
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

    /**
     * @param yearMonth in the form "2016.01"
     * @return a Date object representing the given yearMonth
     */
    var parseYearMonthString = function(yearMonth) {

        var yearMonthInts = yearMonth.match(/(\d{4})[.](\d{2})/);
        logger.fine("parseYearMonthString: yearMonth=" + yearMonth + ", yearMonthInts=" + JSON.stringify(yearMonthInts) );
        
        return new Date(yearMonthInts[1] + "/" + yearMonthInts[2] + "/01");
    };
        

    return {
        createDateLabels: createDateLabels,
        createMonthLabels: createMonthLabels,
        formatMonthLabel: formatMonthLabel,
        formatEpochAsDate: formatEpochAsDate,
        parseYearMonthString: parseYearMonthString,
        dateDiff: dateDiff
    };
}])


/**
 * TODO: do the same for charts.js?
 * underscore.js support.
 */
.factory('_', function() {
    return window._; // assumes underscore has already been loaded on the page
})

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
 * Copied from: http://stackoverflow.com/questions/25678560/angular-passing-scope-to-ng-include
 * For passing objects into the ng-include scope.
 *
 * Example:
 * <div ng-include-template="'template.html'" ng-include-variables="{ item: 'whatever' }"></div>
 *
 * TODO: i don't think this is being used.
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
 * 
 * Usage:
 * <canvas tm-chart-data="{chartDataModel}" />
 *
 * Listens for updates to {chartDataModel} and applies the chartData to the <canvas> element.
 *
 * ------------------------------------------------------------------------
 * https://docs.angularjs.org/guide/directive
 *
 * $scope:
 * By default a directive inherits the parent scope.
 *
 * Isolate scope:
 * You can create an "isolate" scope for the directive.
 * An isolate scope inherits NOTHING from the parent scope EXCEPT for the models you choose.
 *
 * return {
 *     ...
 *     scope: {
 *       customerInfo: '=info'  // inherits model defined by the "info" attribute and assigns it to $scope.customerInfo.
 *     }
 * }
 * 
 *
 *
 */
.directive('tmChartData', [ "_", "$parse", "Logger", "ChartUtils", 
                    function(_,   $parse,   Logger,   ChartUtils) {

    var logger = Logger.getLogger("tmChartData", {all: false} );
    logger.info("alive!");

    /**
     * Called when the $watch listener fires.  The $watch listener listens
     * for updates to the model defined in the ng-chart-data attribute.
     *
     * Attaches the chartData to the <canvas> element.
     *
     * @param element - jqLite-wrapped DOM element
     * @param chartData - updated model
     *
     */
    var renderChart = function(element, chartData) {
        logger.info("renderChart: element=" + element 
                             + ", chartData: " + JSON.stringify(chartData) );

        if ( angular.isDefined( element.data( "tmChart" ) ) ) {
            logger.fine("renderChart: clearing previous chart");
            element.data( "tmChart" ).destroy();
        }

        if ( _.isEmpty(chartData) ) {
            // nothing to do.
            return;
        }

        // Cache the chart in the element so we can destroy it when chartData is updated.
        element.data( "tmChart", ChartUtils.renderChartData( element[0], chartData ) );
    };

    
    /**
     * Sets up a $watch'er on the model defined in the "ng-chart-data" attribute.
     *
     * ----------------------------------------------------------------------------
     * The linkFn is called when the $scope is ready to be linked up with the 
     * compiled template.
     *
     * @param $scope the parent $scope, unless you specified an isolate scope, in which case it's the isolate scope.
     * @param element jqLite-wrapped DOM element.  Use element[0] to get the raw DOM element.
     * @param attrs attributes of the DOM element  
     *
     * @return nothing
     */
    var linkFn = function( $scope, element, attrs ) {

        logger.info("linkFn: element=" + element);

        if (element[0].tagName != "CANVAS") {
            logger.server("linkFn: element is not CANVAS element, " + element);
            return;
        }

        // Note: Upon registration, the watch listener is always called once (async'ly) to initialize the watched value.
        $scope.$watch( attrs.tmChartData, _.partial( renderChart, element ) );
    };

    return {
        link: linkFn
    };
}])




;

