/**
 * thinmint server
 * @rob4lderman
 *
 * Thin REST API around mongodb.
 *
 */

var express = require('express');
var _ = require("underscore");

var app = express();

/**
 * For parsing JSON POST data.
 */
var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.set('json spaces', 2);          // TODO: DEV-MODE!

// -rx- console.log("process.env: " + JSON.stringify(process.env,null,2));

/**
 * Static pages (JS, CSS, etc)
 */
app.use( express.static( "static" ) );

/**
 * For accessing mongodb
 */
var monk = require('monk');
var db = monk( process.env.MONGOLAB_URI || 'mongodb://localhost:27017/thinmint'); 

/**
 * This is like a servlet filter.
 * Append db to the req object so its accessible to our routes.
 */
app.use(function(req,res,next){
    req.db = db;
    next();
});


/**
 * REST API
 * @return all acounts.
 */
app.get('/accounts', function (req, res) {
    var collection = req.db.get('accounts');
    collection.find({},{},function(e,docs){
        res.json(docs);
    });
});

/**
 * REST API
 * @return all tags.
 */
app.get('/tags', function (req, res) {
    var collection = req.db.get('tags');
    collection.find({},{},function(e,docs){
        // There's a single doc in the tags collection, with a single array field named 'tags'.
        res.json(docs[0].tags);
    });
});


/**
 * REST API
 * @return the account with the given id
 */
app.get('/accounts/:id', function (req, res) {
    var collection = req.db.get('accounts');
    console.log("GET /accounts/" + req.params.id);

    collection.id = function (id) { return id; };  // http://stackoverflow.com/questions/25889863/play-with-meteor-mongoid-in-monk

    collection.findOne({ "_id": parseInt(req.params.id) },
                       {},
                       function(e,doc){
        console.log("GET /accounts/" + req.params.id + ": RESPONSE: " + JSON.stringify(doc));
        res.json(doc);
    });
});


/**
 * REST API
 * @return the time series data for the given account 
 */
app.get('/accounts/:id/timeseries', function (req, res) {
    console.log("GET /accounts/" + req.params.id + "/timeseries");

    var collection = req.db.get('accountsTimeSeries');
    collection.id = function (id) { return id; };  // http://stackoverflow.com/questions/25889863/play-with-meteor-mongoid-in-monk

    collection.find({ "accountId": parseInt(req.params.id) },
                    { "sort": { "timestamp": 1 } },
                    function(e,docs){
        console.log("GET /accounts/" + req.params.id + "/timeseries: RESPONSE length: " + docs.length);
        res.json(docs);
    });
});



/**
 * Fetch the object with the given id in the given collection.
 * Pass it to the callback.
 */
var fetchById = function( collection, id, callback ) {
    console.log("fetchById: collection=TODO, id=" + id);
    collection.id = function (id) { return id; };  // http://stackoverflow.com/questions/25889863/play-with-meteor-mongoid-in-monk
    collection.findOne({ "_id": id }, {}, callback );
};


/**
 * Fetch all trans in the given account.  
 * Passed to the callback.
 */
var fetchAccountTrans = function( db, account, callback ) {
    if (account == null) {
        callback(null, []);
        return;
    }

    console.log("fetchAccountTrans: account.accountName=" + account.accountName);

    var collection = db.get("transactions")
    collection.find({ 
                        "account": account.accountName,
                        "fi": account.fiName,
                        "isResolved": { "$exists": false }
                    },
                    { 
                        "sort": { "timestamp": -1 } 
                    },
                    callback );
};


/**
 * REST API
 * @return the transaction data for the given account 
 */
app.get('/accounts/:id/transactions', function (req, res) {
    console.log("GET /accounts/" + req.params.id + "/transactions");

    fetchById( req.db.get("accounts"), 
               parseInt(req.params.id), 
               function(e, account) {
                   fetchAccountTrans(req.db, account, function(e, trans) {
                       console.log("GET /accounts/" + req.params.id + "/transactions: RESPONSE: trans.length=" + trans.length );
                       res.json(trans);
                   });
               });
});


/**
 * REST API
 * @return update the account with the given id and return the WriteResult
 */
app.put('/accounts/:id', function (req, res) {
    var collection = req.db.get('accounts');
    console.log("PUT /accounts/" + req.params.id + ": REQUEST: " + JSON.stringify(req.body))

    collection.id = function (str) { return str; };  // http://stackoverflow.com/questions/25889863/play-with-meteor-mongoid-in-monk

    // TODO: we should NEVER update mint fields... perhaps we should strip them out before updating.
    //       and for that matter, we shoudl never "upsert".
    collection.update({ "_id": parseInt(req.params.id) }, 
                      { "$set": req.body },
                      { "upsert": false },
                      function(e,doc){
        console.log("PUT /accounts/" + req.params.id + ": RESPONSE:\n" + JSON.stringify(docs))
        res.json(doc);
    });
});


/**
 * REST API
 * @return the transaction with the given id
 */
app.get('/transactions/:id', function (req, res) {
    var collection = req.db.get('transactions');
    console.log("GET /transactions/" + req.params.id);

    collection.id = function (id) { return id; };  // http://stackoverflow.com/questions/25889863/play-with-meteor-mongoid-in-monk

    collection.find({ "_id": parseInt(req.params.id) },{},function(e,docs){
        console.log("GET /transactions/" + req.params.id + ": RESPONSE length: " + docs.length);
        res.json(docs);
    });
});


/**
 * REST API
 * @return update the transaction with the given id and return the WriteResult
 */
app.put('/transactions/:id', function (req, res) {
    var collection = req.db.get('transactions');
    console.log("PUT /transactions/" + req.params.id + ": REQUEST: " + JSON.stringify(req.body))

    collection.id = function (str) { return str; };  // http://stackoverflow.com/questions/25889863/play-with-meteor-mongoid-in-monk

    // TODO: we should NEVER update mint fields... perhaps we should strip them out before updating.
    //       and for that matter, we shoudl never "upsert".
    collection.update({ "_id": parseInt(req.params.id) }, 
                      { "$set": req.body },
                      { "upsert": false },
                      function(e,doc){
        console.log("PUT /transactions/" + req.params.id + ": RESPONSE:\n" + JSON.stringify(doc))
        res.json(doc);
    });

    // Also update the tags collection
    var tagsCollection = req.db.get('tags');
    tagsCollection.id = function (str) { return str; };  // http://stackoverflow.com/questions/25889863/play-with-meteor-mongoid-in-monk

    tagsCollection.update({ '_id': 1 }, 
                          { '$addToSet': { 'tags': { '$each': (req.body.tags || []) } } } ,
                          { "upsert": true },
                      function(e,doc){
        console.log("UPDATE /tags " + JSON.stringify(req.body.tags || []) + ": COMPLETE");
    });

});



/**
 * REST API
 *
 * curl -X POST \
 *      -d '{ "query": { "accountType": "bank" }, "options": { "fields": { "accountName": 1, "accountType": 1 } } }' \
 *      -H 'content-type:application/json'  \
 *      http://localhost:8081/query/accounts
 */
app.post('/query/accounts', function (req, res) {
    var collection = req.db.get('accounts');
    console.log("POST /query/accounts: REQUEST: " + JSON.stringify(req.body))
    collection.find( req.body.query || {}, 
                     req.body.options || {},
                     function(e,docs){
        console.log("POST /query/accounts: RESPONSE length: " + docs.length)
        res.json(docs);
    });
});


/**
 * REST API
 *
 * curl -X POST \
 *   -d '{ "query": { "account": "SAVINGS" }, "options": { "fields": { "account": 1, "date": 1, "amount": 1, "category": 1, "omerchant": 1, "isDebit": 1 } } }' \
 *   -H 'content-type:application/json'  \
 *   http://localhost:8081/query/transactions
 *
 */
app.post('/query/transactions', function (req, res) {
    var collection = req.db.get('transactions');
    console.log("POST transactions/query: REQUEST: " + JSON.stringify(req.body))
    collection.find( req.body.query || {}, 
                     req.body.options || {},
                     function(e,docs){
        console.log("POST transactions/query: RESPONSE length: " + docs.length);
        res.json(docs);
    });
});

/**
 * REST API
 *
 * curl -X POST \
 *   -d '{ "query": { "account": "SAVINGS" } }' \
 *   -H 'content-type:application/json'  \
 *   http://localhost:8081/query/transactions/count
 *
 * Returns the COUNT.
 */
app.post('/query/transactions/count', function (req, res) {
    var collection = req.db.get('transactions');
    console.log("POST transactions/query/count: REQUEST: " + JSON.stringify(req.body))
    collection.count( req.body.query || {}, 
                     function(e,count){
                         console.log("POST transactions/query/count: " + count)
                         res.json([count]);
                     });
});

/**
 * REST API
 *
  curl -X POST \
    -d '{ "query": { "account": "SAVINGS" } }' \
    -H 'content-type:application/json'  \
    http://localhost:8081/query/transactions/summary
 *
 * Returns the summary: count, sum(amountValue)
 */
app.post('/query/transactions/summary', function (req, res) {
    var collection = req.db.get('transactions');
    console.log("POST transactions/query/summary: REQUEST: " + JSON.stringify(req.body))
    collection.find( req.body.query || {}, 
                     function(e,trans){
                         var retMe = { count: trans.length,
                                       amountValue: _.reduce( trans, 
                                                              function(memo, tran) {
                                                                  return memo + tran.amountValue;
                                                              },
                                                              0)  // memo
                                     }
        console.log("POST transactions/query/summary: " + JSON.stringify(retMe))
        res.json(retMe);
    });
});



/**
 * REST API
 * @return WriteResult
 */
app.post('/savedqueries', function (req, res) {
    var collection = req.db.get('savedqueries');
    console.log("POST /savedqueries: REQUEST: " + JSON.stringify(req.body))

    var savedQuery = req.body;
    savedQuery.query = JSON.stringify( savedQuery.query );
    console.log("POST /savedqueries: savedQuery: " + JSON.stringify(savedQuery))

    collection.id = function (str) { return str; };  // http://stackoverflow.com/questions/25889863/play-with-meteor-mongoid-in-monk
    collection.update({ "_id": savedQuery.name }, 
                      { "$set": savedQuery },
                      { "upsert": true },
                      function(e,doc){
        console.log("POST /savedqueries: RESPONSE:\n" + JSON.stringify(e) + ", " + JSON.stringify(doc))
        res.json(doc);
    });
});

/**
 * REST API
 * @return all saved queries.
 */
app.get('/savedqueries', function (req, res) {
    var collection = req.db.get('savedqueries');
    collection.find({},{},function(e,savedQueries) {
        console.log("GET /savedqueries: savedQueries: " + JSON.stringify(savedQueries))
        savedQueries.forEach( function(savedQuery) {
                                  savedQuery.query = JSON.parse(savedQuery.query);
                              });
        console.log("GET /savedqueries: savedQueries: " + JSON.stringify(savedQueries))
        res.json(savedQueries);
    });
});




var server = app.listen(process.env.PORT || 8081, function () {

  var host = server.address().address
  var port = server.address().port

  console.log("Example app listening at http://%s:%s", host, port)

})

