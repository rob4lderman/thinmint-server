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

        var postData = { "query": { "$or": [ { "hasBeenAcked": { "$exists": false } }, { "hasBeenAcked" : false } ] } };
        $http.post( "/query/transactions", postData )
             .then( function success(response) {
                 console.log( "fetchNewTrans: response=" + JSON.stringify(response,null,2));
                 $scope.newTrans = response.data;
             }, function error(response) {
                 alert("POST /query/transactions: response=" + JSON.stringify(response)); // TODO: dev
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
                 $scope.accounts = response.data;
             }, function error(response) {
                 alert("GET /accounts: response=" + JSON.stringify(response)); // TODO: dev
             } );
    };


    /**
     * TODO
     */
    var ackNewTran = function(tranId) {

        console.log("ackNewTran: " + tranId);
        $scope.newTrans = _.filter( $scope.newTrans, function(tran) { return tran._id != tranId } );

    };


    /**
     * Export to $scope
     */
    $scope.accounts = [];
    $scope.newTrans = [];
    $scope.ackNewTran = ackNewTran;

    fetchAccounts();
    fetchNewTrans();

}])


/**
 * TODO
 */
.controller( "TagFormController",   ["$scope", "$http", "_",
                            function( $scope,   $http,   _ ) {

    console.log("TagFormController: alive!: $scope.tran=" + $scope.tran.amount);

    /**
     * Called whenever the tag input field changes
     */
    var onTagInputChange = function() {
        console.log("TagFormController.onTagInputChange: " + $scope.tagString);
    };

    /**
     * TODO
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

        if (isEmpty(tag)) {
            return;
        }

        // Create tags field if it doesn't exist
        $scope.tran.tags = $scope.tran.tags || [];  

        if ( ! _.contains($scope.tran.tags, tag) ) {
            $scope.tran.tags.push(tag);
            putTranTags();
        }
    }

    /**
     * TODO
     */
    var onFormSubmit = function() {
        console.log("TagFormController.onFormSubmit: " + $scope.tagString);
        addTranTag( $scope.tagString )
        $scope.tagString = "";
    }

    $scope.onTagInputChange = onTagInputChange;
    $scope.onFormSubmit = onFormSubmit;

}])



/**
 * underscore.js support.
 */
.factory('_', function() {
    return window._; // assumes underscore has already been loaded on the page
});

