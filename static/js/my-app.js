angular.module( "MyApp", [] )

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
 * underscore.js support.
 */
.factory('_', function() {
    return window._; // assumes underscore has already been loaded on the page
});

