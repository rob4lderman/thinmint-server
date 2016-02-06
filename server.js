/**
 * thinmint server
 * @rob4lderman
 *
 * Thin REST API around mongodb.
 *
 */

var express = require('express');
var app = express();

/**
 * For parsing JSON POST data.
 */
var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.set('json spaces', 2);          // TODO: DEV-MODE!

/**
 * Static pages (JS, CSS, etc)
 */
app.use( express.static( "static" ) );

/**
 * For accessing mongodb
 */
var monk = require('monk');
var db = monk('mongodb://localhost:27017/thinmint'); // TODO: get from env.

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
})

/**
 * REST API
 * @return the account with the given id
 */
app.get('/accounts/:id', function (req, res) {
    var collection = req.db.get('accounts');
    console.log("GET /accounts/" + req.params.id);

    collection.id = function (id) { return id; };  // http://stackoverflow.com/questions/25889863/play-with-meteor-mongoid-in-monk

    collection.find({ "_id": parseInt(req.params.id) },{},function(e,docs){
        console.log("GET /accounts/" + req.params.id + ": RESPONSE: " + JSON.stringify(docs));
        res.json(docs);
    });
})


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
})


/**
 * REST API
 * @return the transaction with the given id
 */
app.get('/transactions/:id', function (req, res) {
    var collection = req.db.get('transactions');
    console.log("GET /transactions/" + req.params.id);

    collection.id = function (id) { return id; };  // http://stackoverflow.com/questions/25889863/play-with-meteor-mongoid-in-monk

    collection.find({ "_id": parseInt(req.params.id) },{},function(e,docs){
        console.log("GET /transactions/" + req.params.id + ": RESPONSE: " + JSON.stringify(docs));
        res.json(docs);
    });
})


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
        console.log("PUT /transactions/" + req.params.id + ": RESPONSE:\n" + JSON.stringify(docs))
        res.json(doc);
    });
})



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
    console.log("POST accounts/query: REQUEST: " + JSON.stringify(req.body))
    collection.find( req.body.query || {}, 
                     req.body.options || {},
                     function(e,docs){
        console.log("POST accounts/query: RESPONSE:\n" + JSON.stringify(docs))
        res.json(docs);
    });
})


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
        console.log("POST transactions/query: RESPONSE:\n" + JSON.stringify(docs))
        res.json(docs);
    });
})




var server = app.listen(8081, function () {

  var host = server.address().address
  var port = server.address().port

  console.log("Example app listening at http://%s:%s", host, port)

})

