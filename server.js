/**
 * thinmint server
 * @rob4lderman
 *
 * Thin REST API around mongodb.
 *
 */

var express = require('express');
var _ = require("underscore");

/**
 * For encrypting passwords.
 * https://masteringmean.com/lessons/46-Encryption-and-password-hashing-with-Nodejs
 */
var crypto = require('crypto');

/**
 * For accessing mongodb
 */
var monk = require('monk');
var db = monk( process.env.MONGOLAB_URI || 'mongodb://localhost:27017/thinmint'); 

/**
 * For HTTP BASIC auth.
 * http://passportjs.org/docs/basic-digest
 */
var passport = require('passport')
var BasicStrategy = require('passport-http').BasicStrategy;

/**
 * Configure passport with BASIC auth strateigy
 */
passport.use(new BasicStrategy( function(username, password, done) {
                                    var hash = crypto.createHash("md5")
                                                     .update(password)
                                                     .digest('hex');

                                    console.log("BasicStrategy.callback: username=" + username + ", password hash:" + hash);

                                    var collection = db.get('/tm/users');
                                    collection.id = function (id) { return id; };  // http://stackoverflow.com/questions/25889863/play-with-meteor-mongoid-in-monk
                                    collection.findOne({ "_id": username,
                                                         "password": hash 
                                                       },
                                                       { },
                                                       function(err,user){
                                                           console.log("BasicStrategy:/tm/users.find: err=" + JSON.stringify(err) 
                                                                                                  + ", user=" + JSON.stringify(user) );
                                                           if (err) {
                                                               return done(err);
                                                           } else if (!user) {
                                                               return done(null, false, { message: "Incorrect user or password" });
                                                           } else {
                                                               return done(null, user);
                                                           }
                                                       });
                                }) 
            );

var app = express();

/**
 * For parsing JSON POST data.
 */
var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
// app.set('json spaces', 2);          // TODO: DEV-MODE!

// -rx- console.log("process.env: " + JSON.stringify(process.env,null,2));

/**
 * Static pages (JS, CSS, etc)
 */
app.use( express.static( "static" ) );
app.use( passport.initialize() );
// app.use( passport.session() );


/**
 * http://expressjs.com/en/guide/using-middleware.html
 * app.use() registers MIDDLEWARE functions.
 * Each middleware function must call next() to invoke the next middleware function.
 * Very similar to servlet filters.
 *
 * Append db to the req object so its accessible to our routes.
 */
app.use(function(req,res,next){
    req.db = db;
    next();
});


/**
 * http://stackoverflow.com/questions/25889863/play-with-meteor-mongoid-in-monk
 */
var mongoIdFn = function(id) {
    return id;
};

/**
 * @param req object, which should have req.db and req.user attached.
 * @param collectionName
 *
 * @return the user's collection, e.g. "/tm/{user._id}/{collectionName}"
 */
var getUserCollection = function(req, collectionName) {
    var retMe = req.db.get("/tm/" + req.user._id + "/" + collectionName);
    retMe.id = mongoIdFn;  
    return retMe;
};



/**
 * REST API
 * @return all acounts.
 */
app.get('/accounts', 
        passport.authenticate('basic', { session: false }),
        function (req, res) {
    var collection = getUserCollection(req, "accounts");
    collection.find({},
                    {},
                    function(err,docs){
                        docs = docs || [];
                        res.json(docs);
                    });
});

/**
 * REST API
 * @return all tags.
 */
app.get('/tags', 
        passport.authenticate('basic', { session: false }),
        function (req, res) {
    var collection = getUserCollection(req, "tags");
    collection.findOne({ "_id": 1 },
                       {},
                       function(err,doc){
                           doc = doc || { tags: [] };
                           res.json(doc.tags);
                       });
});


/**
 * REST API
 * @return the account with the given id
 */
app.get('/accounts/:id', 
        passport.authenticate('basic', { session: false }),
        function (req, res) {
    console.log("GET /accounts/" + req.params.id);

    var collection = getUserCollection(req, "accounts");
    collection.findOne({ "_id": parseInt(req.params.id) },
                       {},
                       function(err,doc){
                           console.log("GET /accounts/" + req.params.id + ": RESPONSE: " + JSON.stringify(doc)
                                                                   + ", err: " + JSON.stringify(err) );
                           res.json(doc);
                       });
});


/**
 * REST API
 * @return the time series data for the given account 
 */
app.get('/accounts/:id/timeseries', 
        passport.authenticate('basic', { session: false }),
        function (req, res) {
    console.log("GET /accounts/" + req.params.id + "/timeseries");

    var collection = getUserCollection(req, "accountsTimeSeries");

    collection.find({ "accountId": parseInt(req.params.id) },
                    { "sort": { "timestamp": 1 } },
                    function(err,docs){
                        docs = docs || [];
                        console.log("GET /accounts/" + req.params.id + "/timeseries: RESPONSE length: " + docs.length
                                                                           + ", err: " + JSON.stringify(err) );
                        res.json(docs);
                    });
});


/**
 * Fetch the object with the given id in the given collection.
 * Pass it to the callback.
 */
var fetchById = function( collection, id, callback ) {
    console.log("fetchById: collection=TODO, id=" + id);
    collection.findOne({ "_id": id }, {}, callback );
};


/**
 * Fetch all trans in the given account.  
 * Passed to the callback.
 */
var fetchAccountTrans = function( tranCollection, account, callback ) {
    if (account == null) {
        callback(null, []);
        return;
    }

    console.log("fetchAccountTrans: account.accountName=" + account.accountName);

    tranCollection.find({ 
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
app.get('/accounts/:id/transactions', 
        passport.authenticate('basic', { session: false }),
        function (req, res) {
    console.log("GET /accounts/" + req.params.id + "/transactions");

    fetchById( getUserCollection(req, "accounts"),
               parseInt(req.params.id), 
               function(e, account) {
                   fetchAccountTrans(getUserCollection(req, "transactions"), 
                                     account, 
                                     function(e, trans) {
                                         console.log("GET /accounts/" + req.params.id + "/transactions: RESPONSE: trans.length=" + trans.length );
                                         res.json(trans);
                                     });
               });
});


/**
 * REST API
 * @return update the account with the given id and return the WriteResult
 */
app.put('/accounts/:id', 
        passport.authenticate('basic', { session: false }),
        function (req, res) {
    console.log("PUT /accounts/" + req.params.id + ": REQUEST: " + JSON.stringify(req.body))

    var collection = getUserCollection(req, "accounts");

    // TODO: we should NEVER update mint fields... perhaps we should strip them out before updating.
    //       and for that matter, we shoudl never "upsert".
    collection.update({ "_id": parseInt(req.params.id) }, 
                      { "$set": req.body },
                      { "upsert": false },
                      function(err,doc){
                          doc = doc || {};
                          console.log("PUT /accounts/" + req.params.id + ": RESPONSE:\n" + JSON.stringify(docs)
                                                                   + ", err: " + JSON.stringify(err) );
                          res.json(doc);
                      });
});


/**
 * REST API
 * @return the transaction with the given id
 */
app.get('/transactions/:id', 
        passport.authenticate('basic', { session: false }),
        function (req, res) {
    console.log("GET /transactions/" + req.params.id);

    var collection = getUserCollection(req, "transactions");

    collection.find({ "_id": parseInt(req.params.id) },
                    {},
                    function(err,doc){
                        doc = doc || {};
                        console.log("GET /transactions/" + req.params.id + ": RESPONSE: " + JSON.stringify(doc)
                                                                    + ", err: " + JSON.stringify(err) );
                        res.json(doc);
                    });
});


/**
 * REST API
 * @return update the transaction with the given id and return the WriteResult
 */
app.put('/transactions/:id', 
        passport.authenticate('basic', { session: false }),
        function (req, res) {
    console.log("PUT /transactions/" + req.params.id + ": REQUEST: " + JSON.stringify(req.body))

    var collection = getUserCollection(req, "transactions");

    // TODO: we should NEVER update mint fields... perhaps we should strip them out before updating.
    //       and for that matter, we shoudl never "upsert".
    collection.update({ "_id": parseInt(req.params.id) }, 
                      { "$set": req.body },
                      { "upsert": false },
                      function(err,doc){
                          doc = doc || {};
                          console.log("PUT /transactions/" + req.params.id + ": RESPONSE:\n" + JSON.stringify(doc)
                                                                      + ", err: " + JSON.stringify(err) );
                          res.json(doc);
                      });

    // Also update the tags collection

    var tagsCollection = getUserCollection(req, "tags");

    tagsCollection.update({ '_id': 1 }, 
                          { '$addToSet': { 'tags': { '$each': (req.body.tags || []) } } } ,
                          { "upsert": true },
                          function(err,doc){
                              console.log("UPDATE /tags " + JSON.stringify(req.body.tags || []) + ": COMPLETE"
                                                          + ", err: " + JSON.stringify(err) );
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
app.post('/query/accounts', 
         passport.authenticate('basic', { session: false }),
         function (req, res) {

    console.log("POST /query/accounts: REQUEST: " + JSON.stringify(req.body))
    console.log("POST /query/accounts: user: " + JSON.stringify(req.user));

    var collection = getUserCollection(req, "accounts");
    collection.find( req.body.query || {}, 
                     req.body.options || {},
                     function(err,docs){
                         docs = docs || [];
                         console.log("POST /query/accounts: RESPONSE length: " + docs.length
                                                                   + ", err: " + JSON.stringify(err) );
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
app.post('/query/transactions', 
         passport.authenticate('basic', { session: false }),
         function (req, res) {
    console.log("POST transactions/query: REQUEST: " + JSON.stringify(req.body))
    var collection = getUserCollection(req, "transactions");
    collection.find( req.body.query || {}, 
                     req.body.options || {},
                     function(err,docs){
                         docs = docs || [];
                         console.log("POST transactions/query: RESPONSE length: " + (docs || []).length
                                                                      + ", err: " + JSON.stringify(err) );
                         res.json(docs || []);
                         }
                   );
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
app.post('/query/transactions/count', 
         passport.authenticate('basic', { session: false }),
         function (req, res) {
    console.log("POST transactions/query/count: REQUEST: " + JSON.stringify(req.body))

    var collection = getUserCollection(req, "transactions");
    collection.count( req.body.query || {}, 
                     function(err,count){
                         console.log("POST transactions/query/count: " + count
                                                           + ", err: " + JSON.stringify(err) );
                         res.json([count || 0]);
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
app.post('/query/transactions/summary', 
         passport.authenticate('basic', { session: false }),
         function (req, res) {
    console.log("POST transactions/query/summary: REQUEST: " + JSON.stringify(req.body))

    var collection = getUserCollection(req, "transactions");
    collection.find( req.body.query || {}, 
                     function(err,trans){
                         trans = trans || [];
                         var retMe = { count: trans.length,
                                       amountValue: _.reduce( trans, 
                                                              function(memo, tran) {
                                                                  return memo + tran.amountValue;
                                                              },
                                                              0)  // memo
                                     };
                         console.log("POST transactions/query/summary: " + JSON.stringify(retMe)
                                                             + ", err: " + JSON.stringify(err) );
                         res.json(retMe);
                     });
});


/**
 * REST API
 * @return WriteResult
 */
app.post('/savedqueries', 
         passport.authenticate('basic', { session: false }),
         function (req, res) {
    console.log("POST /savedqueries: REQUEST: " + JSON.stringify(req.body))

    var savedQuery = req.body;
    savedQuery.query = JSON.stringify( savedQuery.query );
    console.log("POST /savedqueries: savedQuery: " + JSON.stringify(savedQuery))

    var collection = getUserCollection(req, "savedqueries");

    collection.update({ "_id": savedQuery.name }, 
                      { "$set": savedQuery },
                      { "upsert": true },
                      function(err,doc){
                          doc = doc || {};
                          console.log("POST /savedqueries: RESPONSE: " + JSON.stringify(doc)
                                                           + ", err: " + JSON.stringify(err) );
                          res.json(doc);
                      });
});

/**
 * REST API
 * @return all saved queries.
 */
app.get('/savedqueries', 
        passport.authenticate('basic', { session: false }),
        function (req, res) {

    var collection = getUserCollection(req, "savedqueries");
    collection.find({},
                    {},
                    function(err,savedQueries) {
                        savedQueries = savedQueries || [];
                        console.log("GET /savedqueries: savedQueries: " + JSON.stringify(savedQueries)
                                                            + ", err: " + JSON.stringify(err) );
                        savedQueries.forEach( function(savedQuery) {
                                                  savedQuery.query = JSON.parse(savedQuery.query);
                                              });
                        console.log("GET /savedqueries: savedQueries: " + JSON.stringify(savedQueries))
                        res.json(savedQueries);
                    });
});

/**
 * REST API
 * @return the saved query with the given id
 */
app.get('/savedqueries/:id', 
        passport.authenticate('basic', { session: false }),
        function (req, res) {

    console.log("GET /savedqueries/" + req.params.id);

    var collection = getUserCollection(req, "savedqueries");

    collection.findOne({ "_id": req.params.id },
                       {},
                       function(err,savedQuery) {
                           if (savedQuery) {
                               savedQuery.query = JSON.parse(savedQuery.query);
                           }
                           console.log("GET /savedqueries: savedQuery: " + JSON.stringify(savedQuery)
                                                               + ", err: " + JSON.stringify(err) );
                           res.json(savedQuery);
                       });
});



/**
 * app.listen initiates the server.
 */
var server = app.listen(process.env.PORT || 8081, function () {

  var host = server.address().address
  var port = server.address().port

  console.log("Example app listening at http://%s:%s", host, port)

})

