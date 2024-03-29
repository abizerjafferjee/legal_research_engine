var User          = require('../Models/User.js')
var pg            = require('pg');
var PythonShell   = require('python-shell');
var jwt           = require('jsonwebtoken');
var secret        = 'mySecret';
var nodemailer    = require('nodemailer');
var request       = require('request');
var util          = require('util');

var DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
// WATSON ENVIRONMENT PARAMETERS
collection_id = '';
configuration_id = '';
environment_id = '';

module.exports = function(router) {

  // WATSON CREDENTIALS
  var discovery = new DiscoveryV1({
    username: "",
    password: "",
    version_date: ''
  });

  // EMAIL CREDENTIALS
  var transporter = nodemailer.createTransport({
    service: '',
    secure: false,
    port: 25,
    auth: {
      user: '',
      pass: ''
    }
  });

  // USER REGISTRATION ROUTE
  //http://localhost:8080/api/users
  router.post('/users', function(req, res){
    var user = new User();
    user.username = req.body.username;
    user.password = req.body.password;
    user.email = req.body.email;
    user.temporarytoken = jwt.sign({ username: user.username, email: user.email }, secret, { expiresIn: '3d' });
    if (user.username == null || user.username == ''){
      res.json({ success: false, message:'Please provide an Username'});
    } else if (user.password == null || user.password == '') {
      res.json({ success: false, message:'Please provide a Password'});
    } else if (user.email == null || user.email == '') {
      res.json({ success: false, message:'Please provide a email'});
    } else {
      user.save(function(err){
        if (err) {

          if (err.errors != null) {
            if (err.errors.email) {
              res.json({ success: false, message: err.errors.email.message });
            } else if (err.errors.username) {
              res.json({ success: false, message: err.errors.username.message });
            } else if (err.errors.password) {
              res.json({ success: false, message: err.errors.password.message });
            } else {
              res.json({ success: false, message: err });
            }
          } else if (err) {
            if (err.code == 11000) {
              res.json({ success: false, message: 'Username or E-mail already taken' });
            } else {
              res.json({ success: false, message: err });
            }
          }
        } else {
          var mailOptions = {
            from: '',
            to: user.email,
            subject: 'Account Activation link',
            text: 'Hello ' + user.username + ', Thank you for registering at .com. Please click on the link below to complete your activation: http://www..com/activate/' + user.temporarytoken,
          };

          transporter.sendMail(mailOptions, function(err, info){
            if (err) {
              console.log(err);
            } else {
              console.log('Email sent');
            }
          });
          res.json({ success: true, message:'Account registered! Please check your email for activation link.' });
        }
      });
    }
  });

  // USER LOGIN ROUTE
  // http://localhost:8080/api/authenticate
  router.post('/authenticate', function(req, res){
    User.findOne({ email: req.body.email })
    .select('email username password active')
    .exec(function(err, user){
      if (err) throw err;
      if (!user) {
        res.json({ success: false, message: 'Could not authenticate user'});
      } else if (user) {
        if (req.body.password) {
          var validPassword = user.comparePassword(req.body.password);
        } else {
          res.json({ success: false, message: 'No password provided'});
        }
        if (!validPassword) {
          res.json({ success: false, message: 'Could not authenticate password'});
        } else if (!user.active) {
          res.json({ success: false, message: 'Account is not yet activated. Please check your email for activation link.', expired: true });
        } else {
          var token = jwt.sign({ username: user.username, email: user.email }, secret, { expiresIn: '3d' });
          res.json({ success: true, message: 'User authenticated!', token: token });
        }
      }
    });
  });

  router.put('/activate/:token', function(req, res) {
    User.findOne({ temporarytoken: req.params.token }, function(err, user) {
      if (err) throw err;
      var token = req.params.token;
      jwt.verify(token, secret, function(err, decoded){
        if (err) {
          console.log(err);
          res.json({ success: false, message: 'Activation link has expired.'});
        } else if (!user) {
          res.json({ success: false, message: 'Activation link has expired.'});
        } else {
          user.temporarytoken = false;
          user.active = true;
          user.save(function(err) {
            if (err) {
              console.log(err);
            } else {


              var mailOptions = {
                from: '',
                to: user.email,
                subject: 'Account Activation link',
                text: 'Hello' + user.username + ', Your account has been successfully activated!',
                html: 'Hello<strong> ' + user.username + '</strong>,<br><br> Your account has been successfully activated!'
              };

              transporter.sendMail(mailOptions, function(err, info){
                if (err) {
                  console.log(err);
                } else {
                  console.log('Email sent');
                }
              });
              res.json({ success: true, message: 'Account activated!'});
            }
          });
        }
      });
    });
  });

  router.post('/resend', function(req, res){
    User.findOne({ email: req.body.email })
    .select('email password active')
    .exec(function(err, user){
      if (err) throw err;
      if (!user) {
        res.json({ success: false, message: 'Could not authenticate user'});
      } else if (user) {
        if (req.body.password) {
          var validPassword = user.comparePassword(req.body.password);
        } else {
          res.json({ success: false, message: 'No password provided'});
        }
        if (!validPassword) {
          res.json({ success: false, message: 'Could not authenticate password'});
        } else if (user.active) {
          res.json({ success: false, message: 'Account is already activated.' });
        } else {
          res.json({ success: true, user: user });
        }
      }
    });
  });

  router.put('/resend', function(req, res) {
    User.findOne({ email: req.body.email })
    .select('username email temporarytoken')
    .exec(function(err, user) {
      if (err) throw err;
      user.temporarytoken = jwt.sign({ username: user.username, email: user.email }, secret, { expiresIn: '3d' });
      user.save(function(err) {
        if (err) {
          console.log(err);
        } else {
          var mailOptions = {
            from: '',
            to: user.email,
            subject: 'Account Activation link Request',
            text: 'Hello ' + user.username + ', you recently requested a new account activation link at . Please click on the link below to complete your activation: http://www..com/activate/' + user.temporarytoken,
            html: 'Hello <strong> ' + user.username + '</strong>,<br><br>You recently requested a new account activation link at .com. Please click on the link below to complete your activation.<br><br><a href="http://www..com/activate/' + user.temporarytoken + '">http://www..com/activate/</a>'
          };

          transporter.sendMail(mailOptions, function(err, info){
            if (err) {
              console.log(err);
            } else {
              console.log('Email sent');
            }
          });
          res.json({ success: true, message: 'Activation link has been sent to: ' + user.email + '!'});
        }
      })
    })
  });

  router.get('/resetusername/:email', function(req, res) {
    User.findOne({ email: req.params.email }).select('email username').exec(function(err, user) {
      if (err) {
        res.json({ success: false, message: err });
      } else {
        if (!req.params.email) {
          res.json({ success: false, message: 'No Email was provided' });
        } else {
          if (!user){
            res.json({ success: false, message: 'E-mail was not found!' });
          } else {
            var mailOptions = {
              from: '',
              to: user.email,
              subject: 'Username Request',
              text: 'Hello ' + user.username + ', you recently requested your username! Your username is: ' + user.username,
              html: 'Hello <strong> ' + user.username + '</strong>,<br><br>You recently requested your username! Your username is: ' + user.username
            };

            transporter.sendMail(mailOptions, function(err, info){
              if (err) {
                console.log(err);
              } else {
                console.log('Email sent');
              }
            });

            res.json({ success: true, message: 'Username has been sent to Email!' });
          }
        }
      }
    });
  });

  router.put('/resetpassword', function(req, res) {
    User.findOne({ email: req.body.email })
    .select('username active email resettoken')
    .exec(function(err, user) {
      if (err) throw err;
      if (!user) {
        res.json({ success: false, message: 'Email was not found!'})
      } else if (!user.active) {
        res.json({ success: false, message: 'Account has not yet been activated, Please check your Email!' })
      } else {
        user.resettoken = jwt.sign({ username: user.username, email: user.email }, secret, { expiresIn: '3d' });
        user.save(function(err) {
          if (err) {
            res.json({ success: false, message: err });
          } else {
            var mailOptions = {
              from: '',
              to: user.email,
              subject: 'Reset Password Request',
              text: 'Hello ' + user.username + ', you recently requested a password reset link. Please click on the link below to reset your password: href="http://www..com/newpassword/' + user.resettoken,
              html: 'Hello <strong> ' + user.username + '</strong>,<br><br>You recently requested a password reset link. Please click on the link below to reset your password:<br><br><a href="http://www..com/newpassword/' + user.resettoken + '">http://www..com/newpassword/</a>'
            };

            transporter.sendMail(mailOptions, function(err, info){
              if (err) {
                console.log(err);
              } else {
                console.log('Email sent');
              }
            });

            res.json({ success: true, message: 'Please check your Email for the password reset link.' })
          }
        });
      }
    });
  });

  router.get('/resetpassword/:token', function(req, res) {
    User.findOne({ resettoken: req.params.token })
    .select()
    .exec(function(err, user) {
      if (err) throw err;
      var token = req.params.token;
      // function to verify token
      jwt.verify(token, secret, function(err, decoded){
        if (err) {
          console.log(err);
          res.json({ success: false, message: 'Reset Password link has expired!' });
        } else {
          if (!user) {
            res.json({ success:false, message: 'Password link has expired!' });
          } else {
            res.json({ success: true, user: user });
          }
        }
      });
    });
  });

  router.put('/savepassword', function(req, res) {
    User.findOne({ email: req.body.email })
    .select('username email password resettoken')
    .exec(function(err, user) {
      if (err) throw err;
      if (req.body.password == null || req.body.password == '') {
        res.json({ success: false, message: 'Password not provided' });
      } else {
        user.password = req.body.password;
        user.resettoken = false;
        user.save(function(err) {
          if (err) {
            res.json({ success: false, message: err});
          } else {
            var mailOptions = {
              from: '',
              to: user.email,
              subject: 'Reset Password',
              text: 'Hello ' + user.username + ', this Email is to notify you that your password was recently reset at .com',
              html: 'Hello <strong> ' + user.username + '</strong>,<br><br> This Email is to notify you that your password was recently reset at .com'
            };

            transporter.sendMail(mailOptions, function(err, info){
              if (err) {
                console.log(err);
              } else {
                console.log('Email sent');
              }
            });
            res.json({ success: true, message: 'Password has been reset!' });
          }
        });
      }
    });
  });

  router.post('/displaycase/:case_id', function(req, res) {
    console.log(req.params.case_id);
    //console.log(req.body);
    res.json(req.body);
  });

  router.delete('/deleteaccount/:email', function(req, res) {
     User.findOneAndRemove({ email: req.params.email })
     .exec(function(err, info) {
       if (err) {
         res.json({ success: false, message: 'Something went wrong, account could NOT be deleted!' });
       } else {
         res.json({ success: true, message: 'Account successfully deleted!' });
       }
     });
  });

  router.use(function(req, res, next){
    var token = req.body.token || req.headers['x-access-token'];

    if (token){
      // function to verify token
      jwt.verify(token, secret, function(err, decoded){
        if (err) {
          console.log(err);
          res.json({ success: false, message: 'Invalid token'});
        } else {
          req.decoded = decoded;
          next();
        }
      });
    } else {
      res.json({ success: false, message: 'No token provided' });
    }
  });

  router.post('/currentUser', function(req, res){
    res.send(req.decoded);
  });

  // data to send: id | username | query | id/caserank | docid | score(0,1)
  router.post('/userfeedback', function(req, res) {
    // Connecting to the PSQL DB
    var connectionString = '';
    var client = new pg.Client(connectionString);
    client.connect(err => {
      if (err) { throw err; }
    });
    //var query = client.query('set search_path to user_feedback');
    console.log("INSERT INTO user_feedback.relevancy_score (username, query, docid, score) VALUES ('" + req.body.username + "','" + req.body.query + "','" + req.body.docid + "'," + req.body.score + ")");
    var query2 = client.query("INSERT INTO user_feedback.relevancy_score (username, query, docid, score) VALUES ('" + req.body.username + "','" + req.body.query + "','" + req.body.docid + "'," + req.body.score + ")");
    query2.then((result) =>
      // link to res.row type: https://github.com/brianc/node-postgres/wiki/FAQ
      res.json(JSON.parse(JSON.stringify(result))));
  });

  // USER SEARCH ROUTE
  //http://localhost:8080/api/search
  router.post('/search', function(req, res){
    console.log(req.body.query);

    // WATSON API QUERY
    //QUERY PARAMETERS
    natural_language_query = req.body.query;
    count = 100;
    offset = 0;
    passages = true;
    highlight = true;
    //return_fields = ['id', 'result_metadata', 'extracted_metadata', 'html', 'enriched_text', 'highlight'];
    filter = 'enriched_text.entities.type:"Location",enriched_text.entities.type:"Organization"';
    // aggregation = '';
    // sort = [];

    //filters
    court = req.body.court;
    if (court != undefined) {
      add = `,enriched_text.entities.disambiguation.name::"${court}"`;
      filter = filter + add;
    }

    parameters = {environment_id: environment_id, collection_id: collection_id,
                  natural_language_query: natural_language_query, count: count,
                  offset: offset, passages: passages, highlight: highlight};

    //QUERY
    discovery.query(parameters, function(error, data) {
      // MAKE SURE TO TAKE CARE OF THE ERRORS IF THEY HAPPEN
      res.json(data);
    });
  });

  return router;
}
