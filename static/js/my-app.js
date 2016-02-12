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
                 $scope.accounts = response.data ;
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
                 $scope.accounts = response.data;
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

    // -rx- /**
    // -rx-  * PUT the tag updates to the db.
    // -rx-  */
    // -rx- var putTranTags = function() {
    // -rx-     console.log("TagFormController.putTranTags: " + JSON.stringify($scope.tran.tags));
    // -rx-     var putData = { "tags": $scope.tran.tags } ;
    // -rx-     $http.put( "/transactions/" + $scope.tran._id, putData )
    // -rx-          .then( function success(response) {
    // -rx-              console.log( "TagFormController.putTranTags: response=" + JSON.stringify(response,null,2));
    // -rx-          }, function error(response) {
    // -rx-              alert("PUT /transactions/" + $scope.tran._id + ": response=" + JSON.stringify(response)); // TODO: dev
    // -rx-          } );
    // -rx- };


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
    var getNetWorth = function() {
        var retMe = _.reduce($scope.accounts, 
                             function(memo, account) { 
                                 return memo + account.value;
                             }, 
                             0);
        console.log("MainController.getNetWorth: " + retMe);
        return retMe;
    };
        

    /**
     * Export to $scope
     */
    $scope.accounts = [];
    $scope.newTrans = [];
    $scope.ackNewTran = ackNewTran;
    $scope.formatEpochAsDate = formatEpochAsDate;
    $scope.getNetWorth = getNetWorth;

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

    /**
     * Called whenever the tag input field changes
     */
    var onChangeInputTag = function() {
        if ( $scope.inputTag.length >= 2 ) {
            // Filter for auto-complete list
            $scope.filteredTags = _.filter( $scope.tags, function(tag) { return tag.startsWith( $scope.inputTag ); } );
            console.log("TagFormController.onChangeInputTag: " + $scope.inputTag + "; filteredTags=" + JSON.stringify($scope.filteredTags) );
        } else {
            $scope.filteredTags = [];
        }
    };

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

    /**
     * Called when a filteredTag from the auto-complete list is clicked.
     */
    var onClickFilteredTag = function(filteredTag) {
        console.log("TagFormController.onClickFilteredTag: " + filteredTag );
        addTranTag(filteredTag);
        
        // TODO: should use angular directive?
        var inputElem = angular.element( document.querySelector("#input-tag-" + $scope.tran._id) );
        console.log("TagFormController.onClickFilteredTag: inputElem=" + inputElem);
        inputElem[0].focus();
    }

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
    $scope.onChangeInputTag = onChangeInputTag;
    $scope.onFormSubmit = onFormSubmit;
    $scope.onClickFilteredTag = onClickFilteredTag;
    $scope.removeTag = removeTag;

    /**
     * Init data.
     */
    $scope.filteredTags = [];

}])



/**
 * underscore.js support.
 */
.factory('_', function() {
    return window._; // assumes underscore has already been loaded on the page
});

