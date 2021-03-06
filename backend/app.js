const config = require('config');
const express = require('express');
const session = require('express-session');
const log = require('npmlog');
const morgan = require('morgan');
const passport = require('passport');

const JWTStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const OidcStrategy = require('passport-openidconnect').Strategy;

const db = require('./src/models');
const utils = require('./src/components/utils');
const authRouter = require('./src/routes/auth');
const v1Router = require('./src/routes/v1');

const apiRouter = express.Router();
const state = {
  isShutdown: false
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({
  extended: false
}));

app.use(session({
  secret: config.get('oidc.clientSecret'),
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// Logging Setup
log.level = config.get('server.logLevel');
log.addLevel('debug', 1500, {
  fg: 'cyan'
});

// Print out configuration settings in verbose startup
log.verbose('Config', JSON.stringify(config));

// Skip if running tests
if (process.env.NODE_ENV !== 'test') {
  // Add Morgan endpoint logging
  app.use(morgan(config.get('server.morganFormat')));

  // Check database connection and exit if unsuccessful
  db.sequelize.authenticate()
    .then(() => log.info('Database connection established'))
    .catch(err => {
      log.error(err);
      db.sequelize.close();
      process.exit(1);
    });
}

// Resolves OIDC Discovery values and sets up passport strategies
utils.getOidcDiscovery().then(discovery => {
  // Add Passport OIDC Strategy
  passport.use('oidc', new OidcStrategy({
    issuer: discovery.issuer,
    authorizationURL: discovery.authorization_endpoint,
    tokenURL: discovery.token_endpoint,
    userInfoURL: discovery.userinfo_endpoint,
    clientID: config.get('oidc.clientID'),
    clientSecret: config.get('oidc.clientSecret'),
    callbackURL: '/getok/api/auth/callback',
    scope: discovery.scopes_supported
  }, (_issuer, _sub, profile, accessToken, refreshToken, done) => {
    if ((typeof (accessToken) === 'undefined') || (accessToken === null) ||
      (typeof (refreshToken) === 'undefined') || (refreshToken === null)) {
      return done('No access token', null);
    }

    profile.jwt = accessToken;
    profile.refreshToken = refreshToken;
    return done(null, profile);
  }));

  // Add Passport JWT Strategy
  passport.use('jwt', new JWTStrategy({
    algorithms: discovery.token_endpoint_auth_signing_alg_values_supported,
    // Keycloak 7.3.0 no longer automatically supplies matching client_id audience.
    // If audience checking is needed, check the following SO to update Keycloak first.
    // Ref: https://stackoverflow.com/a/53627747
    // audience: config.get('oidc.clientID'),
    issuer: discovery.issuer,
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: config.get('oidc.publicKey')
  }, (jwtPayload, done) => {
    if ((typeof (jwtPayload) === 'undefined') || (jwtPayload === null)) {
      return done('No JWT token', null);
    }

    done(null, {
      email: jwtPayload.email,
      familyName: jwtPayload.family_name,
      givenName: jwtPayload.given_name,
      jwt: jwtPayload,
      name: jwtPayload.name,
      preferredUsername: jwtPayload.preferred_username,
    });
  }));
});

passport.serializeUser((user, next) => next(null, user));
passport.deserializeUser((obj, next) => next(null, obj));

// GetOK Base API Directory
apiRouter.get('/', (_req, res) => {
  if(state.isShutdown) {
    res.status(500).end('not ok');
  } else {
    res.status(200).json({
      endpoints: [
        '/api/auth',
        '/api/v1'
      ],
      versions: [
        1
      ]
    });
  }
});

// Root level Router
app.use(/(\/getok)?(\/api)?/, apiRouter);

// Auth Router
apiRouter.use('/auth', authRouter);

// v1 Router
apiRouter.use('/v1', v1Router);

// Handle 500
app.use((err, _req, res, next) => {
  log.error(err.stack);
  res.status(500).json({
    status: 500,
    message: 'Internal Server Error: ' + err.stack.split('\n', 1)[0]
  });
  next();
});

// Handle 404
app.use((_req, res) => {
  res.status(404).json({
    status: 404,
    message: 'Page Not Found'
  });
});

// Prevent unhandled errors from crashing application
process.on('unhandledRejection', err => {
  log.error(err.stack);
});

// Graceful shutdown support
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  log.info('Received kill signal. Draining DB connections and shutting down...');
  state.isShutdown = true;
  db.sequelize.close();
  // Wait 3 seconds before hard exiting
  setTimeout(() => process.exit(), 3000);
}

module.exports = app;
